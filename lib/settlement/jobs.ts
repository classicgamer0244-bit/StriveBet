import type { SyncJob } from "@/lib/sync/lock";

/**
 * Settlement's own lock-guarded jobs, following the same {key, ttlMs, leaseMs,
 * errorBackoffMs} convention as lib/ilotbet/sync/jobs.ts. leaseMs is always
 * comfortably above each job's realistic worst case, since a lease that expires
 * mid-run invites an overlapping second run.
 */
export const SETTLEMENT_JOBS = {
  /**
   * Authoritative fixture resolution (./resolve-fixtures.ts).
   *
   * 2 minutes, not seconds, and deliberately so: the ilotbet branch spends the
   * same global 1-request/second gate (lib/ilotbet/client.ts) that the 25s live
   * sync and every on-demand fixture open draw from. Running this hotter would
   * starve the live feed to chase fixtures that, by definition, finished at
   * least 110 minutes ago and are in no hurry.
   */
  resolveFixtures: { key: "settlement:resolve-fixtures", ttlMs: 120_000, leaseMs: 180_000, errorBackoffMs: 120_000 },

  /** Overdue policy (./overdue.ts) — thresholds are 3h/24h, so minute-level
   * precision buys nothing. */
  overdueBets: { key: "settlement:overdue", ttlMs: 10 * 60_000, leaseMs: 120_000, errorBackoffMs: 5 * 60_000 },
} as const satisfies Record<string, SyncJob>;
