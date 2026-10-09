import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import { computeMatchPhase } from "@/lib/simulation/phase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const fixture = result.fixture;

  // "End match & settle now" can land after the simulated clock has already
  // passed a scheduled goal that the periodic tick (lib/simulation/tick.ts)
  // just hasn't run against yet — freezing at fixture.scoreHome/scoreAway as
  // last written would silently drop that goal. Apply anything due by the
  // current simulated minute first, same as the automatic tick, so manually
  // ending a match that's already effectively over doesn't lose its last
  // event; events scheduled after the current minute (a genuine early
  // cutoff) are correctly left unapplied.
  const phase = computeMatchPhase(
    {
      simKickoffTs: Number(fixture.simKickoffTs),
      compression: fixture.compression,
      secondHalfKickoffTs: fixture.secondHalfKickoffTs !== null ? Number(fixture.secondHalfKickoffTs) : undefined,
      stoppageMinutes: fixture.stoppageMinutes ?? undefined,
      firstHalfStoppageMinutes: fixture.firstHalfStoppageMinutes ?? undefined,
    },
    Date.now()
  );

  let scoreHome = fixture.scoreHome ?? 0;
  let scoreAway = fixture.scoreAway ?? 0;
  const nextEvents = fixture.scheduledEvents.map((event) => {
    if (!event.applied && event.atMinute <= phase.minute) {
      if (event.team === "home") scoreHome += event.deltaGoals;
      else scoreAway += event.deltaGoals;
      return { ...event, applied: true };
    }
    return event;
  });

  const updated = await db.adminFixture.update({
    where: { id },
    data: {
      status: "FINISHED",
      minute: "FT",
      scoreHome,
      scoreAway,
      scheduledEvents: nextEvents,
    },
  });
  await settleBetsForFixtures([id]);

  return NextResponse.json({ fixture: serializeAdminFixtureFull(updated) });
}
