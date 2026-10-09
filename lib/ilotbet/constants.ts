/**
 * How long an on-demand single-match DETAIL fetch's markets stay "protected"
 * from being overwritten by the next routine list sync, and how long
 * lib/ilotbet/fixtures.ts waits before re-fetching detail for an
 * already-open fixture. Shorter while live (odds move faster, users are
 * actively watching) than otherwise — matches the plan's proposed TTLs.
 */
export const DETAIL_MARKETS_TTL_LIVE_MS = 20_000;
export const DETAIL_MARKETS_TTL_MS = 5 * 60_000;
