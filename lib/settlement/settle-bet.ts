import { resolveLegResult, type FinalScore, type LegResult } from "./resolve-leg";
import { getMultiBonusPercent } from "@/lib/betslip-labels";

export interface SettlementFixtureInfo {
  status: "upcoming" | "live" | "halftime" | "finished" | "cancelled";
  score?: FinalScore;
  /** Needed only for the HT/FT market — see resolve-leg.ts. Admin fixtures
   * always have this (derived from their scheduled goal events); real
   * fixtures only have it if it was captured while the match was still live
   * (see lib/ilotbet/sync's periodScoresList handling) — undefined means
   * that leg safely voids instead of guessing. */
  halftimeScore?: FinalScore;
  /** Ice hockey "Regular Time" markets only — undefined voids those legs. */
  regulationScore?: FinalScore;
}

export interface BetLegForSettlement {
  fixtureId: string;
  marketName: string;
  selectionLabel: string;
  odds: number;
}

export interface BetForSettlement {
  status: "OPEN" | "WON" | "LOST" | "VOID" | "CASHED_OUT";
  stakeMinor: number;
  legs: BetLegForSettlement[];
}

export interface BetSettlementResult {
  status: "WON" | "LOST" | "VOID";
  payoutMinor: number;
  legResults: LegResult[];
}

/**
 * Settle an open bet if — and only if — every leg's fixture has reached a
 * terminal state (a multi-leg bet spanning fixtures that haven't all ended
 * returns null, not ready yet). Legs can reference either an admin-simulated
 * fixture or a real api-football fixture — the caller resolves both into the
 * same `fixturesById` shape via lib/settlement/fixture-lookup.ts.
 *
 * A cancelled fixture (admin aborted the match) is a terminal state too —
 * its leg voids immediately rather than blocking the bet forever waiting on
 * a score that will never come; other legs still wait their turn as usual.
 */
export function settleBetIfReady(
  bet: BetForSettlement,
  fixturesById: Map<string, SettlementFixtureInfo>
): BetSettlementResult | null {
  if (bet.status !== "OPEN") return null;

  const legResults: LegResult[] = [];
  for (const leg of bet.legs) {
    const info = fixturesById.get(leg.fixtureId);
    if (!info) return null;
    if (info.status === "cancelled") {
      legResults.push("void");
      continue;
    }
    if (info.status !== "finished" || !info.score) return null;
    legResults.push(resolveLegResult(leg, info.score, info.halftimeScore, info.regulationScore));
  }

  const anyLost = legResults.some((r) => r === "lost");
  const allVoid = legResults.every((r) => r === "void");

  if (anyLost) return { status: "LOST", payoutMinor: 0, legResults };
  if (allVoid) return { status: "VOID", payoutMinor: bet.stakeMinor, legResults };

  // Won: void legs collapse to odds 1.0 for the effective multiplier. The
  // multi-bet bonus % (same table the betslip panel and bet placement key
  // off, by the bet's full original leg count) applies here too, on top of
  // the actual payout — it's real money now, not just a pre-bet estimate,
  // mirroring app/api/bets/route.ts's potentialPayoutMinor formula exactly
  // so a bet that shows a bonus-inclusive "potential win" the whole time
  // it's open actually pays that amount out when it wins.
  const effectiveOdds = bet.legs.reduce((acc, leg, i) => (legResults[i] === "void" ? acc : acc * leg.odds), 1);
  const bonusPercent = getMultiBonusPercent(bet.legs.length);
  const payoutMinor = Math.round(bet.stakeMinor * effectiveOdds * (1 + bonusPercent / 100));
  return { status: "WON", payoutMinor, legResults };
}
