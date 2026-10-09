import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { resolveSelections } from "@/lib/bets/resolve-selections";
import { serializeBet } from "@/lib/bets/serialize";
import { getMultiBonusPercent } from "@/lib/betslip-labels";
import { toMinor } from "@/lib/money";
import { decrementBalanceIfSufficient, toAccountKind } from "@/lib/accounts/balance";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { nowMs } from "@/lib/id";

const bodySchema = z.object({
  selections: z
    .array(z.object({ fixtureId: z.string(), marketId: z.string(), selectionId: z.string() }))
    .min(1)
    .max(20),
  stake: z.number().positive(),
  // Still accepted so an older client (or a stale betslip persisted in
  // localStorage) doesn't get a validation error — the value is ignored, see
  // below.
  mode: z.enum(["REAL", "SIM"]).optional(),
});

/**
 * Demo mode is retired. The platform is live and every bet is real money.
 *
 * The server, not the client, decides this: the betslip's mode was persisted in
 * localStorage indefinitely, so players who toggled it once kept silently
 * placing demo bets in every later session — and since no screen showed the
 * mode, they only found out when a "win" of tens of thousands didn't reach
 * their balance. Forcing REAL here means no client, however stale its cached
 * state, can place a bet that doesn't move real money.
 */
const BET_MODE = "REAL" as const;

export async function POST(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Log in to place a bet." }, { status: 401 });
  if (account.status !== "ACTIVE") return NextResponse.json({ error: "Your account has been suspended." }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid bet." }, { status: 400 });

  const { selections, stake } = parsed.data;
  const mode = BET_MODE;
  const result = await resolveSelections(selections);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const unavailable = result.resolved.find((r) => r.fixtureStatus === "finished" || r.fixtureStatus === "cancelled");
  if (unavailable) {
    const reason = unavailable.fixtureStatus === "cancelled" ? "was cancelled" : "has already finished";
    return NextResponse.json({ error: `${unavailable.fixtureLabel} ${reason}.` }, { status: 400 });
  }

  const stakeMinor = BigInt(toMinor(stake));
  if (mode === "REAL" && stakeMinor > BigInt(account.balanceMinor)) {
    return NextResponse.json({ error: "Insufficient balance." }, { status: 400 });
  }

  if (mode === "REAL") {
    const debited = await decrementBalanceIfSufficient(account.kind, account.id, Number(stakeMinor));
    if (!debited) return NextResponse.json({ error: "Insufficient balance." }, { status: 400 });
  }

  const totalOdds = result.resolved.reduce((acc, r) => acc * r.odds, 1);
  // Mirrors the betslip panel's own display formula exactly (stake * odds,
  // then + the same multi-bet bonus % — components/betslip/betslip-panel.tsx,
  // getMultiBonusPercent keyed on the same selection count) so the "potential
  // win" a player sees before staking is the number they still see once the
  // bet is open, instead of the panel promising a bonus-inclusive figure
  // that silently vanishes the moment the bet is actually placed.
  const bonusPercent = getMultiBonusPercent(result.resolved.length);
  const potentialPayoutMinor = BigInt(Math.round(Number(stakeMinor) * totalOdds * (1 + bonusPercent / 100)));

  const bet = await db.bet.create({
    data: {
      accountId: account.id,
      accountKind: toAccountKind(account.kind),
      referringAdminId: account.referrerAdminId ?? undefined,
      stakeMinor,
      mode,
      totalOdds,
      potentialPayoutMinor,
      status: "OPEN",
      legs: result.resolved.map((r) => ({
        fixtureId: r.fixtureId,
        fixtureLabel: r.fixtureLabel,
        gameId: r.gameId,
        kickoffAt: new Date(r.kickoffAt),
        marketId: r.marketId,
        marketName: r.marketName,
        marketLabel: r.marketLabel,
        selectionId: r.selectionId,
        selectionLabel: r.selectionLabel,
        odds: r.odds,
      })),
    },
  });

  // Audit-trail only — a SIM-mode bet never touched real money, so it gets
  // no transaction record. `stake_${bet.id}` (not a fresh nanoid) makes this
  // naturally idempotent and traceable straight back to the bet; a failure
  // here must never undo an already-placed, already-debited bet, so it's
  // logged and swallowed rather than thrown, same as this codebase's
  // existing SMS-failure convention.
  if (mode === "REAL") {
    try {
      await db.transaction.create({
        data: {
          accountId: account.id,
          accountKind: toAccountKind(account.kind),
          type: "BET",
          status: "SUCCESS",
          amountMinor: Number(stakeMinor),
          method: "Bet stake",
          phone: account.phone,
          reference: `stake_${bet.id}`,
          referringAdminId: account.referrerAdminId ?? undefined,
        },
      });
    } catch (err) {
      console.error(`failed to record BET transaction for bet ${bet.id}:`, err);
    }
  }

  return NextResponse.json({ bet: serializeBet(bet) }, { status: 201 });
}

export async function GET(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const base = {
    accountId: account.id,
    accountKind: toAccountKind(account.kind),
    // Bets the player cleared from their history are kept for accounting (see
    // the DELETE handler in ./[id]/route.ts) but must not come back into their
    // view. Mongo distinguishes "field absent" from "explicitly null", and
    // every pre-existing bet has the field absent.
    OR: [{ hiddenAt: null }, { hiddenAt: { isSet: false } }],
  };
  const where =
    status === "open"
      ? { ...base, status: "OPEN" as const }
      : status === "settled"
        ? {
            ...base,
            status: { in: ["WON", "LOST", "VOID", "CASHED_OUT"] as Array<"WON" | "LOST" | "VOID" | "CASHED_OUT"> },
          }
        : base;

  await tickAdminFixturesIfDue(nowMs());
  const bets = await db.bet.findMany({ where, orderBy: { placedAt: "desc" } });
  return NextResponse.json({ bets: bets.map(serializeBet) });
}
