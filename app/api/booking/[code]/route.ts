import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFixtureById } from "@/lib/fixtures";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slip = await db.bookingSlip.findUnique({ where: { code: code.toUpperCase() } });
  if (!slip || slip.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "That booking code wasn't found or has expired." }, { status: 404 });
  }

  const uniqueFixtureIds = [...new Set(slip.selections.map((s) => s.fixtureId))];
  const fixtures = await Promise.all(uniqueFixtureIds.map((id) => getFixtureById(id)));
  const fixturesById = new Map(uniqueFixtureIds.map((id, i) => [id, fixtures[i]]));

  // Once any leg's game has actually finished (or been cancelled, or aged
  // out of the cache entirely), the exact multi this code represents can
  // never be staked again — reject the whole code up front rather than
  // silently loading a degraded slip with that leg marked "unavailable".
  // Previously this only expired on a flat 72h timer (EXPIRY_MS in
  // app/api/booking/route.ts), so a code for a match that finished hours or
  // days ago stayed "loadable" — technically shown as unavailable per-leg,
  // but never actually rejected — for up to 3 more days.
  const anySettled = uniqueFixtureIds.some((id) => {
    const fixture = fixturesById.get(id);
    return !fixture || fixture.status === "finished" || fixture.status === "cancelled";
  });
  if (anySettled) {
    return NextResponse.json(
      { error: "That booking code is no longer valid — one of its games has already finished." },
      { status: 404 }
    );
  }

  const selections = slip.selections.map((saved) => {
    const fixture = fixturesById.get(saved.fixtureId);
    const market = fixture?.markets.find((m) => m.id === saved.marketId);
    const selection = market?.selections.find((s) => s.id === saved.selectionId);
    const available = Boolean(fixture && market && selection);

    return {
      fixtureId: saved.fixtureId,
      fixtureLabel: saved.fixtureLabel,
      marketId: saved.marketId,
      marketName: saved.marketName,
      selectionId: saved.selectionId,
      selectionLabel: saved.selectionLabel,
      // Loaded at CURRENT odds when still available, matching real
      // sportsbooks — the price you booked at isn't guaranteed to hold.
      odds: available && selection ? selection.odds : saved.oddsAtBooking,
      available,
    };
  });

  return NextResponse.json({ code: slip.code, selections });
}
