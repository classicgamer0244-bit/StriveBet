import type { SyncJob } from "@/lib/sync/lock";

/** Backstop for pending gateway deposits that never resolve through the
 * active paths (webhook lost, or the deposit-form's own 2-minute poll gave
 * up before the customer approved) — see lib/deposits/sweep.ts. Runs far
 * less often than the my-bets SSE loop's own ~2s cadence; every call there
 * is a lock-guarded no-op except once per ttlMs platform-wide. leaseMs is
 * generous relative to ttlMs for the same reason SIM_TICK_JOB's is (see
 * lib/simulation/sim-tick-job.ts) — a batch of several gateway status
 * checks needs real headroom to finish before another caller decides the
 * lease lapsed and starts an overlapping run. */
export const PENDING_DEPOSIT_SWEEP_JOB: SyncJob = {
  key: "deposits:pending-sweep",
  ttlMs: 30_000,
  leaseMs: 60_000,
  errorBackoffMs: 30_000,
};
