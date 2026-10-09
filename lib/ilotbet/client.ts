import { db } from "@/lib/db";
import { ExpectedRetry } from "@/lib/sync/lock";

export class IlotbetError extends Error {}
/** Upstream said no — a non-2xx HTTP status, a non-zero `code` in the body,
 * or we're inside an active backoff window from a prior such failure. NOT
 * used for a caller merely losing the internal pacing race — see
 * reserveIlotbetSlot(), which retries that case and only ever surfaces an
 * ExpectedRetry (lib/sync/lock.ts) if the retry budget is exhausted. */
export class IlotbetRateLimitError extends IlotbetError {}

const BASE_URL = "https://www.ilotbet.com";
const REQUEST_TIMEOUT_MS = 15_000;
const STATE_KEY = "default";

/** Football, per the endpoints confirmed during planning. */
export const ILOTBET_SPORT_ID = "sr:sport:1";

/** Generic client-identity params observed on a real ilotbet frontend
 * request (`platform`, `platformModel`) — cheap to send, makes our traffic
 * look more like a normal client's rather than a bare script. Deliberately
 * NOT including `loginChannel`/`deviceCode` (also observed on that same
 * request): `loginChannel` looks like it identifies a specific downstream
 * reseller's branded storefront, and copying it would misattribute our
 * traffic to whoever that actually is; `deviceCode` looks like a per-install
 * fingerprint not worth spoofing without knowing what it gates. */
const CLIENT_PARAMS = { platform: 3, platformModel: "1.0" } as const;

// ilotbet's endpoints are fully public and unauthenticated — no API key, no
// rate-limit headers of any kind, so unlike api-football's quota.ts there's
// nothing to observe and adapt to. The only lever available is a
// self-imposed, conservative FIXED interval — deliberately generous relative
// to actual traffic (2 sync jobs firing every 10min/25s, plus occasional
// on-demand match-detail fetches) specifically so this integration never
// looks like abuse of someone else's frontend API.
const REQUEST_SPACING_MS = 1_000;
/** How long reserveIlotbetSlot() will retry before giving up — two of our
 * OWN calls (a background sync job, a user's on-demand detail fetch) both
 * wanting a slot within the same ~1s window is routine under real traffic,
 * not a sign of trouble, so losing that race once should cost a short wait,
 * not an outright failure. */
const SLOT_RETRY_BUDGET_MS = 1_500;
const SLOT_RETRY_INTERVAL_MS = 150;
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readState() {
  return db.ilotbetSyncState.findUnique({ where: { key: STATE_KEY } });
}

/**
 * Throws ExpectedRetry (lib/sync/lock.ts), not IlotbetRateLimitError — the
 * ORIGINAL failure that triggered this backoff window already logged loudly
 * once (enterBackoff()'s console.warn, below). Every subsequent sync
 * attempt that lands while that same window is still active isn't NEW
 * information — it's "yes, we know, still waiting" — so it shouldn't
 * re-alarm as its own fresh "job failed" every ~25s until the window
 * clears. runIfDue treats ExpectedRetry quietly (console.warn, short re-arm)
 * instead of like a brand new failure.
 */
async function assertNotInBackoff(): Promise<void> {
  const state = await readState();
  if (state?.backoffUntil && state.backoffUntil > new Date()) {
    throw new ExpectedRetry(`ilotbet in backoff until ${state.backoffUntil.toISOString()}`);
  }
}

/**
 * When the current backoff window ends, or null if there is none.
 *
 * Exposed so a BATCH caller can check once up front instead of discovering it
 * per request. lib/settlement/resolve-fixtures.ts works through a queue of
 * fixtures under a wall-clock budget: without this it would call ilotbetGet()
 * for every item, have each one throw instantly, and burn its whole budget
 * achieving nothing while looking (from its own counters) like it simply found
 * no work to do.
 */
export async function getIlotbetBackoffUntil(): Promise<Date | null> {
  const state = await readState();
  if (state?.backoffUntil && state.backoffUntil > new Date()) return state.backoffUntil;
  return null;
}

/**
 * Claims the next slot in the global pacing schedule via an atomic
 * compare-and-set, retried with a short wait rather than failing on the
 * first miss. Same reasoning as lib/api-football/quota.ts's
 * reserveRequestSlot() for WHY a shared spacing schedule exists at all:
 * every SyncLock bootstraps at epoch 0, so on cold start every job is
 * simultaneously "due" and would otherwise fire within the same second —
 * this serializes that into a trickle instead. The retry is what makes
 * losing that race, once, a ~150ms wait instead of an outright failure: two
 * of our OWN calls landing within the same ~1s window (a background sync
 * job, a user's on-demand fixture-detail fetch) is routine, not a sign
 * anything is wrong. A caller that still can't get a slot after
 * SLOT_RETRY_BUDGET_MS throws ExpectedRetry (lib/sync/lock.ts) — runIfDue
 * treats that quietly (short re-arm, warn not error) rather than like a
 * genuine upstream failure, since that's genuinely all this is.
 */
export async function reserveIlotbetSlot(): Promise<void> {
  const deadline = Date.now() + SLOT_RETRY_BUDGET_MS;

  for (;;) {
    const now = new Date();
    const existing = await readState();
    const { count } = await db.ilotbetSyncState.updateMany({
      where: {
        key: STATE_KEY,
        // Mongo distinguishes "field absent" from "explicitly null" — both
        // mean no slot has ever been claimed (same quirk ApiFootballQuota
        // already handles).
        OR: [{ nextRequestAt: null }, { nextRequestAt: { isSet: false } }, { nextRequestAt: { lte: now } }],
      },
      data: { nextRequestAt: new Date(now.getTime() + REQUEST_SPACING_MS) },
    });

    if (count > 0) return;

    if (!existing) {
      // No document at all yet (first request ever) — bootstrap it and let
      // this call through; the NEXT caller will find a real nextRequestAt.
      await db.ilotbetSyncState.upsert({
        where: { key: STATE_KEY },
        create: { key: STATE_KEY, nextRequestAt: new Date(now.getTime() + REQUEST_SPACING_MS) },
        update: {},
      });
      return;
    }

    if (Date.now() >= deadline) {
      throw new ExpectedRetry("ilotbet pacing: no slot available after retrying");
    }
    await sleep(SLOT_RETRY_INTERVAL_MS);
  }
}

/** Exponential backoff, min(60s * 2^errors, 15min), cleared on first success. */
async function enterBackoff(reason: string): Promise<void> {
  const existing = await readState();
  const consecutiveErrors = (existing?.consecutiveErrors ?? 0) + 1;
  const delayMs = Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveErrors - 1), BACKOFF_MAX_MS);
  const backoffUntil = new Date(Date.now() + delayMs);

  const lastErrorAt = new Date();
  await db.ilotbetSyncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, consecutiveErrors, backoffUntil, lastError: reason.slice(0, 300), lastErrorAt },
    update: { consecutiveErrors, backoffUntil, lastError: reason.slice(0, 300), lastErrorAt },
  });
  console.warn(`ilotbet: entering backoff (${reason}) for ${Math.round(delayMs / 1000)}s`);
}

async function clearBackoff(): Promise<void> {
  await db.ilotbetSyncState.updateMany({
    where: { key: STATE_KEY, consecutiveErrors: { gt: 0 } },
    data: { consecutiveErrors: 0, backoffUntil: null },
  });
}

/**
 * Thin wrapper over ilotbet's internal frontend API. Every call site MUST
 * live inside a lock-guarded sync job under lib/ilotbet/sync/ — same
 * invariant as api-football's client.ts, checkable the same way:
 * `grep -rn "ilotbetGet" app lib` should only ever match inside
 * lib/ilotbet/sync/.
 *
 * `cache: "no-store"` — Mongo (IlotbetFixtureCache) is the cache layer, not
 * Next's fetch Data Cache, which is per-instance and unshared.
 */
export async function ilotbetGet<T extends { code: number; msg: string }>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  await assertNotInBackoff();
  await reserveIlotbetSlot();

  const url = new URL(`${BASE_URL}${path}`);
  const allParams: Record<string, string | number | undefined> = { ...CLIENT_PARAMS, ...params, timestamp: Date.now() };
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  // A transport-level failure (DNS, TLS, connection refused, or the
  // AbortSignal timeout firing) throws instead of returning a response. That
  // used to propagate without recording anything at all, so the single most
  // likely production symptom — the host being unreachable from this
  // deployment — was also the one that left no trace to diagnose from.
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await enterBackoff(`network ${detail}`);
    throw new IlotbetError(`ilotbet request failed (network) for ${path}: ${detail}`);
  }

  if (!res.ok) {
    await enterBackoff(`HTTP ${res.status}`);
    throw new IlotbetError(`ilotbet request failed: ${res.status} ${url.pathname}`);
  }

  const body = (await res.json()) as T;

  // ilotbet signals its own errors as HTTP 200 with a non-zero `code` —
  // never distinguishable from "genuinely nothing to return" by status alone.
  if (body.code !== 0) {
    await enterBackoff(`code ${body.code}: ${body.msg}`);
    throw new IlotbetError(`ilotbet returned an error for ${path}: code ${body.code} (${body.msg})`);
  }

  await clearBackoff();
  return body;
}
