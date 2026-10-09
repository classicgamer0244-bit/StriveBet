import type { SyncJob } from "@/lib/sync/lock";

/** Deep gateway reconciliation — see lib/deposits/reconcile.ts.
 *
 * Runs far less often than PENDING_DEPOSIT_SWEEP_JOB because it is the slow,
 * thorough pass rather than the fast backstop: it looks back 30 days and
 * re-examines FAILED rows, so a single run can make up to BATCH_LIMIT gateway
 * calls. ttlMs of 10 minutes keeps that load modest while still catching a
 * stuck deposit long before a customer would think to complain. leaseMs is
 * generous relative to ttlMs for the same reason the sweep's is — a batch of
 * 100 status checks needs real headroom before another caller decides the
 * lease lapsed and starts an overlapping run. */
export const DEPOSIT_RECONCILE_JOB: SyncJob = {
  key: "deposits:reconcile",
  ttlMs: 10 * 60_000,
  leaseMs: 5 * 60_000,
  errorBackoffMs: 60_000,
};
