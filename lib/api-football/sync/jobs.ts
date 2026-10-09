import type { SyncJob } from "@/lib/sync/lock";

/**
 * Settlement-only job table — trimmed down as part of the ilotbet cutover.
 * api-football is no longer the listings/odds source (see lib/ilotbet/),
 * but a handful of bets placed before the cutover still reference "af-…"
 * fixtures and need their live state resolved until they settle. See
 * app/api/superadmin/api-football/status/route.ts's `legacyOpenBets` for how
 * to tell when it's finally safe to delete what's left of this integration.
 */
export const SYNC_JOBS = {
  liveFixtures: { key: "af:fixtures:live", ttlMs: 25_000, leaseMs: 30_000, errorBackoffMs: 30_000 },
  betFixtures: { key: "af:fixtures:bets", ttlMs: 60_000, leaseMs: 60_000, errorBackoffMs: 30_000 },
  settlementBackstop: { key: "settlement:live-bets", ttlMs: 5 * 60_000, leaseMs: 120_000, errorBackoffMs: 60_000 },
} as const satisfies Record<string, SyncJob>;

/** Past this age, serving the cache would be actively misleading (cold
 * start, or a long idle period) — a read path should await a refresh rather
 * than background it. Only jobs a read path can block on need an entry. */
export const HARD_TTL_MS = {
  liveFixtures: 150_000,
  betFixtures: 300_000,
} as const;
