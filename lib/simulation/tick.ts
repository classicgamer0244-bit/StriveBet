import { db } from "@/lib/db";
import { settleBetsForFixtures, sweepOrphanedOpenBets } from "@/lib/settlement/settle-bets-for-fixtures";
import { computeMatchPhase, halftimeBreakMs, rollStoppageMinutes } from "@/lib/simulation/phase";
import { runIfDue } from "@/lib/sync/lock";
import { SIM_TICK_JOB, SETTLEMENT_BACKSTOP_JOB } from "@/lib/simulation/sim-tick-job";
import type { AdminFixture } from "@prisma/client";

/**
 * Advances every due admin-created fixture (upcoming → live → halftime →
 * live → finished, applying scheduled score events along the way) and
 * settles any bets that become ready as a result. Runs (a) lazily whenever
 * fixtures are read and look stale, (b) from each active SSE connection's
 * poll loop (see app/api/realtime/fixtures*), and (c) optionally via the
 * CRON_SECRET-protected /api/cron/tick-simulations route for a real
 * scheduler. computeMatchPhase() is the single source of truth for what
 * phase a fixture SHOULD be in right now — this function's job is just to
 * persist that and apply any now-due scheduled events.
 */
export async function tickAdminFixtures(nowMs: number): Promise<{ finishedIds: string[]; changed: AdminFixture[] }> {
  const due = await db.adminFixture.findMany({ where: { status: { in: ["UPCOMING", "LIVE", "HALFTIME"] } } });
  const finishedIds: string[] = [];
  const changed: AdminFixture[] = [];

  for (const fixture of due) {
    if (fixture.status === "UPCOMING") {
      if (nowMs >= Number(fixture.simKickoffTs)) {
        const updated = await db.adminFixture.update({
          where: { id: fixture.id },
          data: {
            status: "LIVE",
            scoreHome: fixture.scoreHome ?? 0,
            scoreAway: fixture.scoreAway ?? 0,
            minute: "1'",
            stoppageMinutes: rollStoppageMinutes(),
            firstHalfStoppageMinutes: rollStoppageMinutes(),
          },
        });
        changed.push(updated);
      }
      continue;
    }

    const phase = computeMatchPhase(
      {
        simKickoffTs: Number(fixture.simKickoffTs),
        compression: fixture.compression,
        secondHalfKickoffTs: fixture.secondHalfKickoffTs !== null ? Number(fixture.secondHalfKickoffTs) : undefined,
        stoppageMinutes: fixture.stoppageMinutes ?? undefined,
        firstHalfStoppageMinutes: fixture.firstHalfStoppageMinutes ?? undefined,
      },
      nowMs
    );

    let scoreHome = fixture.scoreHome ?? 0;
    let scoreAway = fixture.scoreAway ?? 0;
    let eventsChanged = false;

    const nextEvents = fixture.scheduledEvents.map((event) => {
      if (!event.applied && event.atMinute <= phase.minute) {
        eventsChanged = true;
        if (event.team === "home") scoreHome += event.deltaGoals;
        else scoreAway += event.deltaGoals;
        return { ...event, applied: true };
      }
      return event;
    });

    if (phase.isFinished) {
      const updated = await db.adminFixture.update({
        where: { id: fixture.id },
        data: {
          status: "FINISHED",
          minute: "FT",
          scoreHome,
          scoreAway,
          ...(eventsChanged ? { scheduledEvents: nextEvents } : {}),
        },
      });
      finishedIds.push(fixture.id);
      changed.push(updated);
      continue;
    }

    if (phase.isHalftime && fixture.secondHalfKickoffTs === null) {
      // First tick to notice we've crossed 45' — anchor the second half's
      // restart time and freeze here for a real 15-minute break.
      const updated = await db.adminFixture.update({
        where: { id: fixture.id },
        data: {
          status: "HALFTIME",
          minute: "HT",
          scoreHome,
          scoreAway,
          secondHalfKickoffTs: BigInt(nowMs + halftimeBreakMs(fixture.compression)),
          ...(eventsChanged ? { scheduledEvents: nextEvents } : {}),
        },
      });
      changed.push(updated);
      continue;
    }

    // Either still ticking through the first half, still mid-break (no
    // change needed), or the break just ended and the second half resumes —
    // all three collapse to "make sure status/minute/score reflect `phase`".
    const targetStatus = phase.isHalftime ? "HALFTIME" : "LIVE";
    if (eventsChanged || phase.label !== fixture.minute || targetStatus !== fixture.status) {
      const updated = await db.adminFixture.update({
        where: { id: fixture.id },
        data: {
          status: targetStatus,
          minute: phase.label,
          scoreHome,
          scoreAway,
          ...(eventsChanged ? { scheduledEvents: nextEvents } : {}),
        },
      });
      changed.push(updated);
    }
  }

  if (finishedIds.length > 0) {
    await settleBetsForFixtures(finishedIds);
  }

  return { finishedIds, changed };
}

/** Throttled wrapper for the lazy "tick on read" path (called from
 * lib/fixtures.ts on every /api/fixtures request, and from each active SSE
 * connection's poll loop) — keeps live admin fixtures moving even if no
 * external cron is running, without re-scanning on every single request
 * from every polling client. Lock-guarded (lib/api-football/sync/lock.ts)
 * rather than a module-level `lastTickAt` — a module variable only throttles
 * the ONE instance that happens to own it, so with N serverless instances
 * the fixture collection got N concurrent full scans every 3s instead of
 * one; the shared Mongo lock bounds it platform-wide regardless of instance
 * count. Not api-football-related, but reuses the same cross-instance
 * single-flight primitive everything else in lib/api-football/sync/ does. */
export async function tickAdminFixturesIfDue(nowMs: number, options: { deadlineMs?: number } = {}): Promise<void> {
  await runIfDue(SIM_TICK_JOB, async () => void (await tickAdminFixtures(nowMs)));

  // Independently throttled (its own job/lock, 60s ttl) so this backstop
  // scan doesn't add cost to every 3s tick — see SETTLEMENT_BACKSTOP_JOB's
  // doc comment and settleBetsForFixtures's for why it needs to exist at all.
  //
  // `deadlineMs` is threaded through because this is a full settlement batch
  // hiding behind an innocuous-sounding "tick" call. Callers bounded by a hard
  // platform timeout (the cron route) would otherwise spend most of their
  // budget here before their own first step had visibly begun.
  if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs) return;
  await runIfDue(SETTLEMENT_BACKSTOP_JOB, async () => void (await sweepOrphanedOpenBets(options)));
}
