import { db } from "@/lib/db";

export class ApiFootballError extends Error {}
/** We chose not to spend — the daily reserve floor was reached. */
export class ApiFootballQuotaError extends ApiFootballError {}
/** Upstream said no — an HTTP 429 or a quota/plan error in the body. */
export class ApiFootballRateLimitError extends ApiFootballError {}

export type QuotaScope = "listings" | "bets";

const QUOTA_KEY = "default";

// Leaves a deliberate reserve on the daily quota so a sync never runs the
// count to zero. `bets` (settlement, cashout eligibility — money-moving
// correctness) gets a lower floor than `listings` (browsing/odds), so bet
// settlement keeps running even once browsing has eaten most of the budget.
const DAILY_RESERVE_LISTINGS = 2000;
const DAILY_RESERVE_BETS = 500;

const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;

// Global request pacing. Per-job TTLs (lib/api-football/sync/jobs.ts) bound
// how often EACH job fires, but every SyncLock bootstraps at epoch 0 — so on
// cold start every job is simultaneously "due" and would otherwise fire
// within the same second, regardless of the account's real per-minute cap.
// This is a single shared spacing schedule every request (from any job, any
// instance) claims a slot on before firing, so a cold-start burst gets
// serialized into a trickle instead. Spacing adapts to the last-OBSERVED
// X-RateLimit-Limit header rather than a guess at the plan tier — until the
// first response teaches us the real number, assume a deliberately low one
// so we undershoot rather than trip the limiter (which then costs a much
// longer reactive backoff than a slightly-too-cautious pace ever would).
const ASSUMED_MINUTE_LIMIT_BEFORE_OBSERVED = 10;
const MINUTE_SAFETY_FACTOR = 0.7; // pace at 70% of the observed cap, not right at the edge
const MIN_REQUEST_SPACING_MS = 200; // floor, even for a generous observed limit
/** Stop refusing new requests this many ms before the per-minute window is
 * assumed to roll over — api-football doesn't publish the window boundary,
 * only remaining-in-window, so this is an estimate anchored to observedAt. */
const MINUTE_WINDOW_MS = 60_000;
const MINUTE_REMAINING_RESERVE = 1;

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-07-29"
}

function numOrUndef(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function readQuota() {
  return db.apiFootballQuota.findUnique({ where: { key: QUOTA_KEY } });
}

/**
 * Called on EVERY api-football response, success or not — a 429's headers
 * are the most valuable ones we ever get. Also maintains our own
 * requestsToday counter, reset on UTC day rollover, so a plan or proxy that
 * stops sending rate-limit headers still can't produce runaway spend
 * unnoticed. Header lookup via Headers#get() is case-insensitive, so the
 * differing casing between the daily family (x-ratelimit-requests-*) and
 * the per-minute family (X-RateLimit-*) below is a non-issue.
 */
export async function recordQuotaHeaders(res: Response): Promise<void> {
  const dailyLimit = numOrUndef(res.headers.get("x-ratelimit-requests-limit"));
  const dailyRemaining = numOrUndef(res.headers.get("x-ratelimit-requests-remaining"));
  const minuteLimit = numOrUndef(res.headers.get("x-ratelimit-limit"));
  const minuteRemaining = numOrUndef(res.headers.get("x-ratelimit-remaining"));
  const dayKey = todayUtcKey();

  const headerFields = {
    ...(dailyLimit !== undefined ? { dailyLimit } : {}),
    ...(dailyRemaining !== undefined ? { dailyRemaining } : {}),
    ...(minuteLimit !== undefined ? { minuteLimit } : {}),
    ...(minuteRemaining !== undefined ? { minuteRemaining } : {}),
    observedAt: new Date(),
  };

  // Common case: still the same UTC day as the last recorded request — one
  // atomic increment, no read-then-write race.
  const { count } = await db.apiFootballQuota.updateMany({
    where: { key: QUOTA_KEY, requestsDayKey: dayKey },
    data: { ...headerFields, requestsToday: { increment: 1 } },
  });
  if (count > 0) return;

  // First request of a new UTC day, or the singleton doesn't exist yet —
  // reset the counter. A narrow race here (two requests both seeing the old
  // day) at worst double-counts a single day's first request, which is fine
  // for a soft/diagnostic counter — the upstream dailyRemaining header,
  // not this one, is the primary enforcement signal.
  await db.apiFootballQuota.upsert({
    where: { key: QUOTA_KEY },
    create: { key: QUOTA_KEY, ...headerFields, requestsToday: 1, requestsDayKey: dayKey },
    update: { ...headerFields, requestsToday: 1, requestsDayKey: dayKey },
  });
}

/** Throws before a request is made if quota state says we're in backoff, at
 * the last-observed per-minute window's floor, or at/below the daily reserve
 * for this scope. A quota document that has never been observed yet lets
 * the request through — there's nothing to refuse against until the first
 * response teaches us the real limits. */
export async function assertQuotaAvailable(scope: QuotaScope): Promise<void> {
  const quota = await readQuota();
  if (!quota) return;

  const now = new Date();
  if (quota.backoffUntil && quota.backoffUntil > now) {
    throw new ApiFootballRateLimitError(`api-football in backoff until ${quota.backoffUntil.toISOString()}`);
  }

  // The per-minute header only tells us how many requests were left AS OF
  // the last response — reserveRequestSlot()'s pacing is what actually keeps
  // us under the cap request-to-request. This is a secondary guard for the
  // case a burst already ran the counter down to (or past) zero: refuse
  // until roughly the window we last observed should have rolled over.
  if (
    quota.minuteRemaining !== null &&
    quota.minuteRemaining !== undefined &&
    quota.minuteRemaining <= MINUTE_REMAINING_RESERVE &&
    quota.observedAt
  ) {
    const estimatedWindowResetAt = new Date(quota.observedAt.getTime() + MINUTE_WINDOW_MS);
    if (estimatedWindowResetAt > now) {
      throw new ApiFootballRateLimitError(
        `api-football per-minute cap nearly exhausted (${quota.minuteRemaining} remaining) — waiting for the window to roll over`
      );
    }
  }

  const reserve = scope === "bets" ? DAILY_RESERVE_BETS : DAILY_RESERVE_LISTINGS;
  if (quota.dailyRemaining !== null && quota.dailyRemaining !== undefined && quota.dailyRemaining < reserve) {
    throw new ApiFootballQuotaError(
      `api-football daily reserve reached for scope "${scope}" (${quota.dailyRemaining} remaining, reserve ${reserve})`
    );
  }
}

/**
 * Claims the next slot in the global pacing schedule via a single atomic
 * compare-and-set — no retry loop, no blocking wait. A caller that loses the
 * race (or finds the schedule not yet due) gets an immediate
 * ApiFootballRateLimitError and simply doesn't make this request; whichever
 * sync job it came from naturally retries on its own next cycle (see
 * lib/api-football/sync/lock.ts's runIfDue, which treats this exactly like
 * any other thrown failure). That's what turns a cold-start burst — every
 * SyncLock starting at epoch 0, so every job due at once — into a trickle
 * paced to the last-observed per-minute limit, instead of five-plus requests
 * firing in the same second regardless of what the account can actually take.
 */
export async function reserveRequestSlot(): Promise<void> {
  const quota = await readQuota();
  const minuteLimit = quota?.minuteLimit ?? ASSUMED_MINUTE_LIMIT_BEFORE_OBSERVED;
  const spacingMs = Math.max(MIN_REQUEST_SPACING_MS, Math.ceil(60_000 / Math.max(1, minuteLimit * MINUTE_SAFETY_FACTOR)));

  const now = new Date();
  const { count } = await db.apiFootballQuota.updateMany({
    where: {
      key: QUOTA_KEY,
      // Mongo distinguishes "field absent" from "explicitly null" — both
      // mean no slot has ever been claimed (same quirk SyncLock.leaseUntil
      // already handles).
      OR: [{ nextRequestAt: null }, { nextRequestAt: { isSet: false } }, { nextRequestAt: { lte: now } }],
    },
    data: { nextRequestAt: new Date(now.getTime() + spacingMs) },
  });

  if (count === 0) {
    // No existing document at all (first request ever) — the updateMany
    // above matches nothing to update. Bootstrap it and let this call
    // through; the NEXT caller will find a real nextRequestAt to respect.
    if (!quota) {
      await db.apiFootballQuota.upsert({
        where: { key: QUOTA_KEY },
        create: { key: QUOTA_KEY, nextRequestAt: new Date(now.getTime() + spacingMs) },
        update: {},
      });
      return;
    }
    throw new ApiFootballRateLimitError("api-football pacing: another request already claimed this slot");
  }
}

/** Exponential backoff, min(60s * 2^errors, 15min), cleared on first success. */
export async function enterBackoff(reason: string): Promise<void> {
  const existing = await readQuota();
  const consecutiveErrors = (existing?.consecutiveErrors ?? 0) + 1;
  const delayMs = Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveErrors - 1), BACKOFF_MAX_MS);
  const backoffUntil = new Date(Date.now() + delayMs);

  await db.apiFootballQuota.upsert({
    where: { key: QUOTA_KEY },
    create: { key: QUOTA_KEY, consecutiveErrors, backoffUntil, observedAt: new Date() },
    update: { consecutiveErrors, backoffUntil, observedAt: new Date() },
  });
  console.warn(`api-football: entering backoff (${reason}) for ${Math.round(delayMs / 1000)}s`);
}

export async function clearBackoff(): Promise<void> {
  await db.apiFootballQuota.updateMany({
    where: { key: QUOTA_KEY, consecutiveErrors: { gt: 0 } },
    data: { consecutiveErrors: 0, backoffUntil: null },
  });
}
