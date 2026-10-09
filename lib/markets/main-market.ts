import type { Fixture, Market } from "@/types";

/**
 * The headline market a list row/card shows for a fixture, whatever its
 * sport: football's 1X2, or the winner/regular-time market each other sport
 * carries (see lib/ilotbet/sport-markets.ts).
 */
const MAIN_MARKET_NAMES = [
  "1X2",
  "Winner (incl. overtime)",
  "Winner (incl. extra innings)",
  "Match Winner",
  "1X2 (Regular Time)",
];

export function getMainMarket(fixture: Fixture): Market | undefined {
  for (const name of MAIN_MARKET_NAMES) {
    const m = fixture.markets.find((x) => x.name === name);
    if (m) return m;
  }
  return undefined;
}

const OTHER_SPORT_TOTAL = /^Total (Points|Runs|Goals \(Regular Time\)) /;

/** A non-football sport's over/under market for list rows — the line whose
 * over and under prices are closest, i.e. the bookmaker's main line. */
export function getMainTotalMarket(fixture: Fixture): Market | undefined {
  let best: Market | undefined;
  let bestGap = Infinity;
  for (const m of fixture.markets) {
    if (!OTHER_SPORT_TOTAL.test(m.name) || m.selections.length !== 2) continue;
    const gap = Math.abs(m.selections[0].odds - m.selections[1].odds);
    if (gap < bestGap) {
      best = m;
      bestGap = gap;
    }
  }
  return best;
}

/** True when the fixture has no bettable market at all (e.g. cricket). */
export function hasNoOdds(fixture: Fixture): boolean {
  return fixture.markets.length === 0;
}
