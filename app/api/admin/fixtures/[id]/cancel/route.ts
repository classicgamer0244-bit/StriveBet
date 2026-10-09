import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";

/**
 * Aborts a match before or during play — any bets already placed on it void
 * and refund (see lib/settlement/settle-bet.ts's "cancelled" fixture
 * handling), and the fixture stops ticking and disappears from every
 * live/upcoming listing. Can't cancel a match that's already finished —
 * `/settle` is the right tool for ending one prematurely.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (result.fixture.status === "FINISHED") {
    return NextResponse.json({ error: "This match has already finished." }, { status: 400 });
  }
  if (result.fixture.status === "CANCELLED") {
    return NextResponse.json({ error: "This match is already cancelled." }, { status: 400 });
  }

  const updated = await db.adminFixture.update({ where: { id }, data: { status: "CANCELLED" } });
  await settleBetsForFixtures([id]);

  return NextResponse.json({ fixture: serializeAdminFixtureFull(updated) });
}
