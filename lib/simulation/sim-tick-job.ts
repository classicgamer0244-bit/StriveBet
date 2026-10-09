import type { SyncJob } from "@/lib/sync/lock";

/** The admin-simulation minute/score tick's lock config — not tied to either
 * real-fixture data source (api-football or ilotbet), so it gets its own
 * small home rather than living inside either one's job table. Uses the same
 * cross-instance lock (lib/sync/lock.ts) everything else does: a
 * module-level throttle only bounds the one instance that owns it.
 *
 * leaseMs is deliberately generous relative to ttlMs — a big settlement
 * batch inside one tick (lib/simulation/tick.ts, via settleBetsForFixtures)
 * needs real headroom to finish before another caller decides the lease
 * lapsed and starts an overlapping run. A too-short lease here is exactly
 * what let a slow batch and a fresh concurrent tick race the same bets. */
export const SIM_TICK_JOB: SyncJob = { key: "sim:tick", ttlMs: 3_000, leaseMs: 60_000, errorBackoffMs: 3_000 };

/** Orphaned-open-bet backstop (sweepOrphanedOpenBets) — deliberately much
 * less frequent than the tick itself; its entire job is catching a rare
 * failure, not routine progression, so there's no reason to pay its extra
 * `db.bet.findMany({status:"OPEN"})` scan on every 3s tick. */
export const SETTLEMENT_BACKSTOP_JOB: SyncJob = { key: "sim:settlement-backstop", ttlMs: 60_000, leaseMs: 60_000, errorBackoffMs: 30_000 };
