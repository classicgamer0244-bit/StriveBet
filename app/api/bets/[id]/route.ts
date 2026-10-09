import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { serializeBet } from "@/lib/bets/serialize";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bet = await db.bet.findUnique({ where: { id } });
  if (!bet || bet.accountId !== account.id) return NextResponse.json({ error: "Bet not found." }, { status: 404 });

  return NextResponse.json({ bet: serializeBet(bet) });
}

/**
 * Clears a settled bet from the player's own history view.
 *
 * A SOFT delete — it sets `hiddenAt` and keeps the row. The bet record is the
 * accounting evidence for both its stake debit and its payout credit, so
 * destroying it makes that account's balance permanently unexplainable. This
 * previously did a hard `db.bet.delete`, and the consequence was measurable in
 * production: an account showed exactly GHS 1,000 short in reconciliation
 * purely because a lost GHS 1,000 bet had been deleted from history, leaving
 * the debit with nothing to justify it. Worse, any automated reconciler reading
 * bet records would have concluded the player was underpaid and "repaid" money
 * they were never owed.
 *
 * Still restricted to settled bets: an OPEN bet's stake is debited and it could
 * still win, so it must stay visible to its owner.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bet = await db.bet.findUnique({ where: { id } });
  if (!bet || bet.accountId !== account.id) return NextResponse.json({ error: "Bet not found." }, { status: 404 });
  if (bet.status === "OPEN") {
    return NextResponse.json({ error: "Can't delete a bet that hasn't settled yet." }, { status: 400 });
  }

  // Mongo distinguishes "field absent" from "explicitly null", and a bet that
  // has never been cleared has no `hiddenAt` field at all — so a bare
  // `hiddenAt: null` matched NOTHING and this delete silently no-opped for
  // every bet on the platform. Measured before this fix: 0 of 2,033 settled
  // bets had ever been successfully hidden. The read side already got this
  // right (see the OR in app/api/bets/route.ts and the my-bets SSE route),
  // which is precisely why the button looked wired up and did nothing.
  await db.bet.updateMany({
    where: { id, OR: [{ hiddenAt: null }, { hiddenAt: { isSet: false } }] },
    data: { hiddenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
