/**
 * Bookmaker-style market names (data/mock/market-builder.ts) are the
 * settlement key — lib/settlement/resolve-leg.ts string-matches against them,
 * so they're never renamed. This maps those keys to a name a player actually
 * understands (e.g. "1X2" -> "Match Result"), purely for display. Anything
 * not in the map (or matched by a prefix rule below) falls through unchanged
 * — safer than throwing on a market name this map hasn't caught up with yet.
 */

const EXACT_LABELS: Record<string, string> = {
  "1X2": "Match Result",
  "Double Chance": "Double Chance",
  "Both Teams To Score": "Both Teams To Score",
  "Draw No Bet": "Draw No Bet",
  "Odd/even": "Odd/Even Goals",
  "Total Goals Odd/Even": "Total Goals Odd/Even",
  "First Team To Score": "First Team To Score",
  "Home Team Total Goals Over/Under 1.5": "Home Team Over/Under 1.5 Goals",
  "Away Team Total Goals Over/Under 1.5": "Away Team Over/Under 1.5 Goals",
  "1st Half Result": "1st Half Result",
  "2nd Half Result": "2nd Half Result",
  "Half With Most Goals": "Half With Most Goals",
  "Correct Score": "Correct Score",
  "Total Corners Over/Under 9.5": "Corners Over/Under 9.5",
  "Corners 3 Way": "Corners 3-Way Result",
  "Total Cards Over/Under 3.5": "Cards Over/Under 3.5",
  "Any Red Card": "Any Red Card",
  "HT/FT": "Half Time / Full Time",
  "Winning Margin": "Winning Margin",
};

/** Friendly display name for a bookmaker market key — falls back to the raw
 * name unchanged if nothing here recognizes it. */
export function marketDisplayName(marketName: string): string {
  const exact = EXACT_LABELS[marketName];
  if (exact) return exact;

  if (marketName === "Winner (incl. overtime)") return "Match Winner (incl. overtime)";
  if (marketName === "Winner (incl. extra innings)") return "Match Winner (incl. extra innings)";
  if (marketName === "1X2 (Regular Time)") return "Match Result (Regular Time)";
  const otherTotal = /^Total (Points|Runs|Goals \(Regular Time\)) (.+)$/.exec(marketName);
  if (otherTotal) return `${otherTotal[1]} Over/Under ${otherTotal[2]}`;

  if (marketName.startsWith("Total ")) {
    const line = marketName.slice("Total ".length);
    return `Over/Under ${line}`;
  }
  if (marketName.startsWith("3 Way Handicap ")) {
    const line = marketName.slice("3 Way Handicap ".length);
    return `3-Way Handicap ${line}`;
  }

  return marketName;
}
