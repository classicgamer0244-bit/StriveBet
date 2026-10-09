import type { Bet } from "@prisma/client";
import { fromMinor } from "@/lib/money";
import { marketDisplayName } from "@/lib/markets/market-label";

const STATUS_MAP = { OPEN: "open", WON: "won", LOST: "lost", VOID: "void", CASHED_OUT: "cashed_out" } as const;

export function serializeBet(bet: Bet) {
  return {
    id: bet.id,
    accountId: bet.accountId,
    referringAdminId: bet.referringAdminId ?? null,
    placedAt: bet.placedAt.toISOString(),
    stake: fromMinor(Number(bet.stakeMinor)),
    mode: bet.mode,
    totalOdds: bet.totalOdds,
    potentialPayout: fromMinor(Number(bet.potentialPayoutMinor)),
    status: STATUS_MAP[bet.status],
    settledAt: bet.settledAt?.toISOString(),
    payout: bet.payoutMinor !== null ? fromMinor(Number(bet.payoutMinor)) : undefined,
    winNotifiedAt: bet.winNotifiedAt?.toISOString(),
    bookingCode: bet.bookingCode ?? undefined,
    verificationCode: bet.verificationCode ?? undefined,
    cashedOutAt: bet.cashedOutAt?.toISOString(),
    legs: bet.legs.map((leg) => ({
      fixtureId: leg.fixtureId,
      fixtureLabel: leg.fixtureLabel,
      gameId: leg.gameId ?? undefined,
      kickoffAt: leg.kickoffAt?.toISOString(),
      marketId: leg.marketId,
      marketName: leg.marketName,
      // Older legs (placed before marketLabel existed) fall back to the
      // display-name map computed from the frozen settlement key.
      marketLabel: leg.marketLabel ?? marketDisplayName(leg.marketName),
      selectionId: leg.selectionId,
      selectionLabel: leg.selectionLabel,
      odds: leg.odds,
      result: leg.result ?? undefined,
      finalScore:
        leg.finalScoreHome !== null && leg.finalScoreHome !== undefined && leg.finalScoreAway !== null && leg.finalScoreAway !== undefined
          ? { home: leg.finalScoreHome, away: leg.finalScoreAway }
          : undefined,
    })),
  };
}
