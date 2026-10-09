import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { SYNC_JOBS } from "@/lib/ilotbet/sync/jobs";
import { IN_PLAY_STATUSES, SCHEDULED_STATUSES, FINISHED_STATUSES, VOID_STATUSES } from "@/lib/ilotbet/status";

/**
 * Operational visibility into the ilotbet sync layer — pacing/backoff state,
 * every lock's last-run/error, and how many cached fixtures fall into each
 * status bucket. Mirrors app/api/superadmin/api-football/status's shape
 * (now settlement-tail-only) for the same reason it existed: the difference
 * between diagnosing a problem in thirty seconds and in a day.
 */
export async function GET() {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobKeys = Object.values(SYNC_JOBS).map((j) => j.key);

  const [state, locks, liveCount, upcomingCount, finishedCount, voidCount, totalCached, detailSourcedCount] = await Promise.all([
    db.ilotbetSyncState.findUnique({ where: { key: "default" } }),
    db.syncLock.findMany({ where: { key: { in: jobKeys } }, orderBy: { key: "asc" } }),
    db.ilotbetFixtureCache.count({ where: { eventStatus: { in: [...IN_PLAY_STATUSES] } } }),
    db.ilotbetFixtureCache.count({ where: { eventStatus: { in: [...SCHEDULED_STATUSES] } } }),
    db.ilotbetFixtureCache.count({ where: { eventStatus: { in: [...FINISHED_STATUSES] } } }),
    db.ilotbetFixtureCache.count({ where: { eventStatus: { in: [...VOID_STATUSES] } } }),
    db.ilotbetFixtureCache.count(),
    db.ilotbetFixtureCache.count({ where: { marketsSource: "detail" } }),
  ]);

  return NextResponse.json({
    state: state
      ? {
          nextRequestAt: state.nextRequestAt?.toISOString() ?? null,
          backoffUntil: state.backoffUntil?.toISOString() ?? null,
          consecutiveErrors: state.consecutiveErrors,
        }
      : null,
    locks: locks.map((l) => ({
      key: l.key,
      lastRunAt: l.lastRunAt.toISOString(),
      leaseUntil: l.leaseUntil?.toISOString() ?? null,
      runCount: l.runCount,
      lastDurationMs: l.lastDurationMs,
      lastError: l.lastError,
    })),
    jobConfig: SYNC_JOBS,
    cache: { liveCount, upcomingCount, finishedCount, voidCount, totalCached, detailSourcedCount },
  });
}
