export type LegResult = "won" | "lost" | "void";

export interface LegScoreInput {
  marketName: string;
  selectionLabel: string;
}

export interface FinalScore {
  home: number;
  away: number;
}

// 1X2/Draw No Bet/3-Way-Handicap/Half-Result/Corners-3-Way selections used
// short codes ("1"/"X"/"2") until they were renamed to real words
// ("Home"/"Draw"/"Away") for readability. `Bet.legs[].selectionLabel` is a
// frozen snapshot taken at placement time — a bet placed before the rename
// keeps its old-style label forever and is matched against it at
// settlement, never re-fetched live. These sets accept either spelling so
// already-open bets keep settling correctly with zero data migration.
const HOME_LABELS = new Set(["Home", "1"]);
const DRAW_LABELS = new Set(["Draw", "X"]);
const AWAY_LABELS = new Set(["Away", "2"]);
const HOME_OR_DRAW_LABELS = new Set(["Home or Draw", "1X"]);
const HOME_OR_AWAY_LABELS = new Set(["Home or Away", "12"]);
const DRAW_OR_AWAY_LABELS = new Set(["Draw or Away", "X2"]);

/** "Total 2.5" — a bare goals line only. See the usage site for why this is
 * anchored rather than a `startsWith("Total ")` prefix test. */
const TOTAL_LINE_MARKET = /^Total (\d+(?:\.\d+)?)$/;
/** "3 Way Handicap -1 -1" / "+1 +1" / "+2 +2" — data/mock/market-builder.ts
 * emits the same signed integer twice. */
const HANDICAP_MARKET = /^3 Way Handicap ([+-]\d+(?:\.\d+)?) [+-]\d+(?:\.\d+)?$/;

/**
 * Resolve one bet leg from a fixture's final score, plus its halftime score for
 * the four half-based markets (HT/FT, 1st/2nd Half Result, Half With Most
 * Goals). Every market listed in SETTLEABLE_MARKET_NAMES / matched by
 * isSettleableMarket() below is implemented here, and those are the only
 * markets the platform sells — see that predicate's doc comment for how that
 * invariant is enforced at build time and at bet placement.
 *
 * A leg voids (stake refunded for that leg) only where the data genuinely
 * can't decide it: a cancelled fixture, a missing halftime score, or a
 * pre-existing leg on a market that has since been withdrawn from sale.
 */
/** Non-football market names — see lib/ilotbet/sport-markets.ts. */
const WINNER_INCL_EXTRA_TIME_MARKETS = new Set(["Winner (incl. overtime)", "Winner (incl. extra innings)"]);
const TENNIS_MATCH_WINNER = "Match Winner";
/** "Total Points 171.5" (basketball/American football, incl. overtime),
 * "Total Runs 8.5" (baseball, incl. extra innings). */
const POINTS_TOTAL_MARKET = /^Total (Points|Runs) (\d+(?:\.\d+)?)$/;
const REGULAR_TIME_1X2 = "1X2 (Regular Time)";
const REGULAR_TIME_TOTAL_MARKET = /^Total Goals \(Regular Time\) (\d+(?:\.\d+)?)$/;

/** Markets graded on the regulation-time score rather than the final one. */
export function needsRegulationScore(marketName: string): boolean {
  return marketName === REGULAR_TIME_1X2 || REGULAR_TIME_TOTAL_MARKET.test(marketName);
}

export function resolveLegResult(
  leg: LegScoreInput,
  score: FinalScore,
  halftimeScore?: FinalScore,
  regulationScore?: FinalScore
): LegResult {
  const { home, away } = score;
  const total = home + away;
  const name = leg.marketName;
  const label = leg.selectionLabel;

  if (name === "1X2") {
    const outcomeSet = home > away ? HOME_LABELS : home === away ? DRAW_LABELS : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  // Checked before the generic "Total " prefix match below, since
  // "Total Goals Odd/Even" also starts with "Total " but isn't an Over/Under line.
  if (name === "Odd/even" || name === "Total Goals Odd/Even") {
    const isOdd = total % 2 === 1;
    if (label === "Odd") return isOdd ? "won" : "lost";
    if (label === "Even") return !isOdd ? "won" : "lost";
    return "void";
  }

  // Anchored to a bare numeric line ("Total 2.5"), NOT startsWith("Total ") —
  // that looser test also swallowed "Total Corners Over/Under 9.5" and "Total
  // Cards Over/Under 3.5", which then voided on a NaN line here instead of
  // reaching the explicit fall-through at the bottom. Same outcome, but it hid
  // them: anyone adding a real corners handler below would never have seen
  // those legs arrive.
  const totalMatch = TOTAL_LINE_MARKET.exec(name);
  if (totalMatch) {
    const line = Number.parseFloat(totalMatch[1]);
    if (label.startsWith("Over")) return total > line ? "won" : "lost";
    if (label.startsWith("Under")) return total < line ? "won" : "lost";
    return "void";
  }

  if (name === "Both Teams To Score") {
    const yes = home > 0 && away > 0;
    return label === "Yes" ? (yes ? "won" : "lost") : yes ? "lost" : "won";
  }

  if (name === "Double Chance") {
    if (HOME_OR_DRAW_LABELS.has(label)) return home >= away ? "won" : "lost";
    if (HOME_OR_AWAY_LABELS.has(label)) return home !== away ? "won" : "lost";
    if (DRAW_OR_AWAY_LABELS.has(label)) return away >= home ? "won" : "lost";
    return "void";
  }

  if (name === "Draw No Bet") {
    if (home === away) return "void";
    const outcomeSet = home > away ? HOME_LABELS : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  if (name === "Home Team Total Goals Over/Under 1.5") {
    if (label.startsWith("Over")) return home > 1.5 ? "won" : "lost";
    if (label.startsWith("Under")) return home < 1.5 ? "won" : "lost";
    return "void";
  }

  if (name === "Away Team Total Goals Over/Under 1.5") {
    if (label.startsWith("Over")) return away > 1.5 ? "won" : "lost";
    if (label.startsWith("Under")) return away < 1.5 ? "won" : "lost";
    return "void";
  }

  if (name === "Correct Score") {
    // Grid covers 0-4 goals a side (see data/mock/market-builder.ts) — "Other"
    // wins only when the final score falls outside that grid entirely.
    const exact = `${home}:${away}`;
    const inGrid = home <= 4 && away <= 4;
    if (label === "Other") return inGrid ? "lost" : "won";
    return label === exact ? "won" : "lost";
  }

  if (name === "Winning Margin") {
    const diff = home - away;
    const margin =
      diff === 0 ? "Draw" : diff > 0 ? (diff === 1 ? "Home by 1" : "Home by 2+") : diff === -1 ? "Away by 1" : "Away by 2+";
    return label === margin ? "won" : "lost";
  }

  // Fully derivable from the final score — the handicap is applied to the home
  // side, then it's an ordinary 1X2. The line is always a whole number here
  // (market-builder emits -1/+1/+2), so a push IS possible and is what the
  // Draw selection covers; there's no half-goal line to make it unreachable.
  const handicapMatch = HANDICAP_MARKET.exec(name);
  if (handicapMatch) {
    const handicap = Number.parseFloat(handicapMatch[1]);
    const adjustedHome = home + handicap;
    const outcomeSet = adjustedHome > away ? HOME_LABELS : adjustedHome === away ? DRAW_LABELS : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  if (name === "1st Half Result") {
    // Void (not lost) on missing halftime data, same reasoning as HT/FT below:
    // "we don't know" must never be graded as "you lost".
    if (!halftimeScore) return "void";
    const outcomeSet =
      halftimeScore.home > halftimeScore.away
        ? HOME_LABELS
        : halftimeScore.home === halftimeScore.away
          ? DRAW_LABELS
          : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  if (name === "2nd Half Result" || name === "Half With Most Goals") {
    if (!halftimeScore) return "void";
    const secondHome = home - halftimeScore.home;
    const secondAway = away - halftimeScore.away;
    // A negative second half means the two sources disagree — the halftime
    // score is a best-effort parse of ilotbet's periodScoresList while the
    // final score comes from a different field entirely. Void rather than
    // grade on data we already know is inconsistent.
    if (secondHome < 0 || secondAway < 0) return "void";

    if (name === "2nd Half Result") {
      const outcomeSet =
        secondHome > secondAway ? HOME_LABELS : secondHome === secondAway ? DRAW_LABELS : AWAY_LABELS;
      return outcomeSet.has(label) ? "won" : "lost";
    }

    const firstHalfTotal = halftimeScore.home + halftimeScore.away;
    const secondHalfTotal = secondHome + secondAway;
    const winner =
      firstHalfTotal > secondHalfTotal ? "1st Half" : secondHalfTotal > firstHalfTotal ? "2nd Half" : "Equal";
    return label === winner ? "won" : "lost";
  }

  if (name === "HT/FT") {
    // Selections are the short-code grid straight from data/mock/market-builder.ts
    // ("1/1".."2/2") — never renamed to words, unlike 1X2 — so no legacy-label
    // set needed here. Void (not lost) when the halftime score is missing
    // rather than guessing: this market genuinely can't be resolved from the
    // final score alone, and treating "we don't know" as "you lost" would be
    // worse than a stake refund.
    if (!halftimeScore) return "void";
    const code = (h: number, a: number) => (h > a ? "1" : h === a ? "X" : "2");
    const outcome = `${code(halftimeScore.home, halftimeScore.away)}/${code(home, away)}`;
    return label === outcome ? "won" : "lost";
  }

  // --- Non-football sports (lib/ilotbet/sport-markets.ts) -------------------
  // Their names are deliberately distinct from every football market above, so
  // a leg can never be graded by another sport's rules.

  if (WINNER_INCL_EXTRA_TIME_MARKETS.has(name)) {
    // Basketball/American football (incl. overtime), baseball (incl. extra
    // innings): the final score already includes the extra time these markets
    // cover. A tie can't stand under these rules, so one means bad data — void.
    if (home === away) return "void";
    const outcomeSet = home > away ? HOME_LABELS : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  if (name === TENNIS_MATCH_WINNER) {
    // Tennis scores are SETS won. A winner needs at least 2 sets; anything
    // less is a retirement or walkover with no completed result, which we
    // void rather than credit to whoever happened to be ahead.
    if (home === away || Math.max(home, away) < 2) return "void";
    const outcomeSet = home > away ? HOME_LABELS : AWAY_LABELS;
    return outcomeSet.has(label) ? "won" : "lost";
  }

  const pointsTotalMatch = POINTS_TOTAL_MARKET.exec(name);
  if (pointsTotalMatch) {
    const line = Number.parseFloat(pointsTotalMatch[2]);
    if (total === line) return "void"; // whole-number line push
    if (label.startsWith("Over")) return total > line ? "won" : "lost";
    if (label.startsWith("Under")) return total < line ? "won" : "lost";
    return "void";
  }

  if (name === REGULAR_TIME_1X2 || REGULAR_TIME_TOTAL_MARKET.test(name)) {
    // Ice hockey: graded on regulation time only (periods 1-3). The final
    // score may include overtime/shootout, so without a captured regulation
    // score this voids instead of guessing.
    if (!regulationScore) return "void";
    if (name === REGULAR_TIME_1X2) {
      const outcomeSet =
        regulationScore.home > regulationScore.away
          ? HOME_LABELS
          : regulationScore.home === regulationScore.away
            ? DRAW_LABELS
            : AWAY_LABELS;
      return outcomeSet.has(label) ? "won" : "lost";
    }
    const line = Number.parseFloat(REGULAR_TIME_TOTAL_MARKET.exec(name)![1]);
    const regTotal = regulationScore.home + regulationScore.away;
    if (regTotal === line) return "void";
    if (label.startsWith("Over")) return regTotal > line ? "won" : "lost";
    if (label.startsWith("Under")) return regTotal < line ? "won" : "lost";
    return "void";
  }

  // Corners, cards, and first-team-to-score need data the final score can't
  // supply. Nothing should reach here any more — isSettleableMarket() below is
  // asserted against the market builder at startup and enforced again at bet
  // placement — but a leg placed before those guards existed still lands here,
  // and voiding (stake refunded) stays the right answer for it.
  return "void";
}

/** Exactly the market names resolveLegResult() above can actually grade.
 *
 * Lives in this file, immediately below the resolver, so the two cannot drift:
 * a market that isn't listed here silently voids every bet placed on it, which
 * is how 11 sellable markets ended up refunding stakes instead of ever paying
 * out. data/mock/market-builder.ts asserts every market it emits passes this,
 * and lib/bets/resolve-selections.ts rejects anything failing it at placement
 * time — the two together make "sold but ungradeable" unrepresentable. */
const SETTLEABLE_MARKET_NAMES = new Set([
  "1X2",
  "Odd/even",
  "Total Goals Odd/Even",
  "Both Teams To Score",
  "Double Chance",
  "Draw No Bet",
  "Home Team Total Goals Over/Under 1.5",
  "Away Team Total Goals Over/Under 1.5",
  "Correct Score",
  "Winning Margin",
  "HT/FT",
  "1st Half Result",
  "2nd Half Result",
  "Half With Most Goals",
]);

export function isSettleableMarket(marketName: string): boolean {
  return (
    SETTLEABLE_MARKET_NAMES.has(marketName) ||
    TOTAL_LINE_MARKET.test(marketName) ||
    HANDICAP_MARKET.test(marketName) ||
    WINNER_INCL_EXTRA_TIME_MARKETS.has(marketName) ||
    marketName === TENNIS_MATCH_WINNER ||
    POINTS_TOTAL_MARKET.test(marketName) ||
    needsRegulationScore(marketName)
  );
}
