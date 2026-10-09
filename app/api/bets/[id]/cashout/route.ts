import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toAccountKind, incrementBalance } from "@/lib/accounts/balance";
import { serializeBet } from "@/lib/bets/serialize";
import { lookupBetFixtureStates } from "@/lib/bets/fixture-state";
import { isCashoutEligible } from "@/lib/bets/cashout";
import { generateUniqueVerificationCode } from "@/lib/bets/verification-code";

/**
 * Cashes an OPEN bet out for its stake (not potential payout) — only while
 * every leg's fixture hasn't kicked off. Eligibility is re-derived here from
 * live fixture state, never trusted from the client — see
 * lib/bets/cashout.ts, the same helper the UI button and filter chip use.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const accountKind = toAccountKind(account.kind);
  const bet = await db.bet.findUnique({ where: { id } });
  if (!bet || bet.accountId !== account.id || bet.accountKind !== accountKind) {
    return NextResponse.json({ error: "Bet not found." }, { status: 404 });
  }
  if (bet.status !== "OPEN") {
    return NextResponse.json({ error: "This bet has already been settled." }, { status: 400 });
  }

  const fixtureIds = bet.legs.map((leg) => leg.fixtureId);
  const fixtureStates = await lookupBetFixtureStates(fixtureIds);
  const eligible = isCashoutEligible({ status: "open", legs: bet.legs }, fixtureStates);
  if (!eligible) {
    return NextResponse.json({ error: "Cashout is no longer available — a match has started." }, { status: 400 });
  }

  const now = new Date();
  // Generated before the write so the update below stays one atomic
  // compare-and-set on status: "OPEN" — no follow-up write that could race a
  // concurrent settlement tick. A cashout uses the same win-celebration
  // modal as a WON bet (see components/bets/win-celebration-modal.tsx), so
  // it needs a code too.
  const verificationCode = await generateUniqueVerificationCode();
  // The OPEN guard makes this update the race-winner against a concurrent
  // settlement tick or a double-submit — only credit the stake back if this
  // request actually flipped the status.
  const { count } = await db.bet.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "CASHED_OUT", payoutMinor: bet.stakeMinor, cashedOutAt: now, settledAt: now, verificationCode },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This bet was just settled elsewhere — please refresh." }, { status: 409 });
  }

  if (bet.mode === "REAL") {
    await incrementBalance(bet.accountKind === "ADMIN" ? "admin" : "user", bet.accountId, Number(bet.stakeMinor));

    // Audit-trail only — the balance credit above already landed, so a
    // failure here must never undo it or block the response.
    try {
      await db.transaction.create({
        data: {
          accountId: bet.accountId,
          accountKind: bet.accountKind,
          type: "REFUND",
          status: "SUCCESS",
          amountMinor: Number(bet.stakeMinor),
          method: "Bet cashout — stake returned",
          phone: account.phone,
          reference: `cashout_${bet.id}`,
          referringAdminId: bet.referringAdminId ?? undefined,
        },
      });
    } catch (err) {
      console.error(`failed to record REFUND transaction for cashed-out bet ${bet.id}:`, err);
    }
  }

  const updated = await db.bet.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ bet: serializeBet(updated) });
}
