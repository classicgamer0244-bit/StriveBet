import type { SyncJob } from "@/lib/sync/lock";

/**
 * One entry per lock-guarded sync job — key, staleness TTL, and lease
 * duration. Only 2 jobs (vs api-football's original 5): odds arrive
 * embedded in the same match-list calls that fetch facts, so there's no
 * separate odds-config/prematch-odds job, and one unfiltered live call
 * already covers every in-play match, so there's no separate bet-fixtures
 * sweeper either — see lib/ilotbet/sync/live-matches.ts's doc comment.
 */
export const SYNC_JOBS = {
  dailyMatches: { key: "ilotbet:matches:daily", ttlMs: 10 * 60_000, leaseMs: 120_000, errorBackoffMs: 2 * 60_000 },
  liveMatches: { key: "ilotbet:matches:live", ttlMs: 25_000, leaseMs: 45_000, errorBackoffMs: 30_000 },
  /** Non-football sports (./other-sports.ts) — separate locks so they can
   * never delay or fail football's settlement-critical jobs above. One request
   * per sport, so a slightly slower cadence than football's. */
  otherDailyMatches: { key: "ilotbet:other:daily", ttlMs: 10 * 60_000, leaseMs: 120_000, errorBackoffMs: 2 * 60_000 },
  otherLiveMatches: { key: "ilotbet:other:live", ttlMs: 30_000, leaseMs: 60_000, errorBackoffMs: 60_000 },
} as const satisfies Record<string, SyncJob>;

/** Past this age, serving the cache would be actively misleading (cold
 * start, or a long idle period) — a read path should await a refresh rather
 * than background it. */
export const HARD_TTL_MS = {
  dailyMatches: 20 * 60_000,
  liveMatches: 150_000,
} as const;
