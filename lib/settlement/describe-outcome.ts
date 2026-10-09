import type { FinalScore } from "./resolve-leg";

/**
 * Describes what actually happened for a market, given the final score —
 * the inverse of resolve-leg.ts's resolveLegResult (which only says whether
 * a specific pick won or lost). Used purely for display on the ticket detail
 * page ("Outcome: Under 1.5"), so a bettor can see the real result next to
 * what they picked. Covers exactly the markets resolveLegResult settles from
 * the final score alone; every other market (handicaps, half-time-specific
 * markets, corners, cards, HT/FT, first-team-to-score) returns undefined,
 * same as those markets resolving to "void" — there's nothing to describe
 * from the final score alone.
 */
export function describeMarketOutcome(marketName: string, score: FinalScore): string | undefined {
  const { home, away } = score;
  const total = home + away;

  const matchResult = home > away ? "Home" : home === away ? "Draw" : "Away";

  if (marketName === "1X2" || marketName === "Double Chance" || marketName === "Draw No Bet") {
    return matchResult;
  }

  if (marketName === "Odd/even" || marketName === "Total Goals Odd/Even") {
    return total % 2 === 1 ? "Odd" : "Even";
  }

  if (marketName.startsWith("Total ")) {
    const line = Number.parseFloat(marketName.slice("Total ".length));
    if (Number.isNaN(line)) return undefined;
    return total > line ? `Over ${line}` : total < line ? `Under ${line}` : undefined;
  }

  if (marketName === "Both Teams To Score") {
    return home > 0 && away > 0 ? "Yes" : "No";
  }

  if (marketName === "Home Team Total Goals Over/Under 1.5") {
    return home > 1.5 ? "Over 1.5" : "Under 1.5";
  }

  if (marketName === "Away Team Total Goals Over/Under 1.5") {
    return away > 1.5 ? "Over 1.5" : "Under 1.5";
  }

  if (marketName === "Correct Score") {
    return `${home}:${away}`;
  }

  if (marketName === "Winning Margin") {
    const diff = home - away;
    if (diff === 0) return "Draw";
    if (diff > 0) return diff === 1 ? "Home by 1" : "Home by 2+";
    return diff === -1 ? "Away by 1" : "Away by 2+";
  }

  return undefined;
}
