import {
  ApiFootballError,
  ApiFootballRateLimitError,
  assertQuotaAvailable,
  clearBackoff,
  enterBackoff,
  recordQuotaHeaders,
  reserveRequestSlot,
  type QuotaScope,
} from "./quota";

export { ApiFootballError, ApiFootballQuotaError, ApiFootballRateLimitError } from "./quota";

const BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 15_000;

/** True once API_FOOTBALL_KEY is set — callers use this to fail soft (empty
 * results) instead of throwing when the integration hasn't been configured yet. */
export function isApiFootballConfigured(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

export const MAX_IDS_PER_REQUEST = 20;

/** Splits an array into chunks of at most `size` — used to keep a `?ids=`
 * request under api-football's documented 20-id-per-request cap. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Dash-joins fixture ids for the `ids=` query param. Asserts the 20-id cap
 * outside production so a caller that forgot to chunk() first fails loudly
 * in dev/test rather than silently dropping fixtures past position 20 in
 * production (which is exactly how real-fixture bets went unsettled before
 * this file existed — see lib/settlement/settle-live-bets.ts). */
export function joinIds(ids: number[]): string {
  if (process.env.NODE_ENV !== "production" && ids.length > MAX_IDS_PER_REQUEST) {
    throw new Error(`joinIds: ${ids.length} ids exceeds api-football's ${MAX_IDS_PER_REQUEST}-id cap — chunk() first.`);
  }
  return ids.join("-");
}

/**
 * Thin wrapper over api-football's REST API. Every call site MUST live
 * inside a lock-guarded sync job under lib/api-football/sync/ — see that
 * directory's module doc comment for why (no code reachable from an inbound
 * HTTP request may reach api-football directly; that's what let upstream
 * cost scale with connected-user count instead of wall-clock time).
 *
 * Mongo (the ApiFixtureCache collection) is the cache layer now, not Next's
 * fetch Data Cache — that cache is per-instance and unshared, and its
 * revalidate dedupe lives on the per-request workStore, which is why N
 * concurrent SSE connections each fired their own background refetch at
 * every staleness boundary. Opting out entirely (`cache: "no-store"`) means
 * a sync job's own ApiFixtureCache.fetchedAt timestamp is the single source
 * of truth for how fresh the data really is.
 */
export async function apiFootballGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  scope: QuotaScope = "listings"
): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new ApiFootballError("API_FOOTBALL_KEY is not configured.");

  await assertQuotaAvailable(scope);
  // Claims this call's slot in the global pacing schedule — see
  // reserveRequestSlot()'s doc comment. This is what stops a cold-start
  // burst (every SyncLock starting "due" at once) from firing several
  // requests in the same second regardless of the account's real
  // per-minute cap.
  await reserveRequestSlot();

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Unconditional — even a 429's headers tell us the daily/per-minute state.
  await recordQuotaHeaders(res);

  if (res.status === 429) {
    await enterBackoff("HTTP 429");
    throw new ApiFootballRateLimitError(`api-football rate limited: ${url.pathname}`);
  }
  if (!res.ok) {
    throw new ApiFootballError(`api-football request failed: ${res.status} ${url.pathname}`);
  }

  const body = (await res.json()) as T & { errors?: unknown };

  // api-football signals quota exhaustion, a bad key, and plan restrictions
  // as HTTP 200 with a populated `errors` OBJECT and an empty `response`
  // array. Not distinguishing this from "there's genuinely nothing to
  // return" used to mean a throttled upstream silently emptied the site:
  // the old client returned {response: []}, and every caller cached "no
  // fixtures today". `errors` is [] — not {} — on a successful call, hence
  // the Array.isArray check below.
  const errors = body?.errors;
  if (errors && !Array.isArray(errors) && typeof errors === "object" && Object.keys(errors).length > 0) {
    const message = Object.entries(errors as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    if (/limit|quota|requests/i.test(message)) await enterBackoff(message);
    throw new ApiFootballError(`api-football returned an error for ${path}: ${message}`);
  }

  await clearBackoff();
  return body;
}
