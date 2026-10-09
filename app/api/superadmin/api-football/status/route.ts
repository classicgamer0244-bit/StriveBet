import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { readQuota } from "@/lib/api-football/quota";
import { SYNC_JOBS } from "@/lib/api-football/sync/jobs";
import { IN_PLAY_CODES, SCHEDULED_CODES, FINISHED_CODES, VOID_CODES } from "@/lib/api-football/status";
import { isLegacyApiFootballFixtureId } from "@/lib/fixture-id";

/**
 * Settlement-tail-only now — api-football is no longer the listings/odds
 * source (see /api/superadmin/ilotbet/status for that). This exists purely
 * to answer one question: is it safe yet to finish deleting what's left of
 * this integration? `legacyOpenBets` is the number that matters — once it
 * reads 0, every bet that referenced an "af-…" fixture has settled, and
 * lib/api-football/**, ApiFixtureCache, and ApiFootballQuota can come out.
 */
export async function GET() {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobKeys = Object.values(SYNC_JOBS).map((j) => j.key);

  const [quota, locks, inPlayCount, scheduledCount, finishedCount, voidCount, totalCached, openBets] = await Promise.all([
    readQuota(),
    db.syncLock.findMany({ where: { key: { in: jobKeys } }, orderBy: { key: "asc" } }),
    db.apiFixtureCache.count({ where: { statusShort: { in: [...IN_PLAY_CODES] } } }),
    db.apiFixtureCache.count({ where: { statusShort: { in: [...SCHEDULED_CODES] } } }),
    db.apiFixtureCache.count({ where: { statusShort: { in: [...FINISHED_CODES] } } }),
    db.apiFixtureCache.count({ where: { statusShort: { in: [...VOID_CODES] } } }),
    db.apiFixtureCache.count(),
    db.bet.findMany({ where: { status: "OPEN" }, select: { legs: { select: { fixtureId: true } } } }),
  ]);

  const legacyOpenBets = openBets.filter((b) => b.legs.some((l) => isLegacyApiFootballFixtureId(l.fixtureId))).length;

  return NextResponse.json({
    note: "api-football is settlement-tail only — see /api/superadmin/ilotbet/status for the active listings/odds source. Safe to finish deleting lib/api-football/** once legacyOpenBets reads 0.",
    legacyOpenBets,
    quota: quota
      ? {
          dailyLimit: quota.dailyLimit,
          dailyRemaining: quota.dailyRemaining,
          minuteLimit: quota.minuteLimit,
          minuteRemaining: quota.minuteRemaining,
          requestsToday: quota.requestsToday,
          requestsDayKey: quota.requestsDayKey,
          backoffUntil: quota.backoffUntil?.toISOString() ?? null,
          consecutiveErrors: quota.consecutiveErrors,
          observedAt: quota.observedAt?.toISOString() ?? null,
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
    cache: { inPlayCount, scheduledCount, finishedCount, voidCount, totalCached },
  });
}
