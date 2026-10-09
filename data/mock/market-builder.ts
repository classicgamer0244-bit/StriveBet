import type { Market, MarketTabKey, Selection } from "@/types";
import { isSettleableMarket } from "@/lib/settlement/resolve-leg";

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed: string) {
  const rand = mulberry32(hashString(seed));
  return {
    float(min: number, max: number) {
      return min + rand() * (max - min);
    },
    odds(min: number, max: number) {
      return Math.round(this.float(min, max) * 100) / 100;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(rand() * arr.length)];
    },
  };
}

/** Stable ID derived from fixture seed + market name + selection label.
 * Survives server restarts and repeated rebuilds — the same inputs always
 * produce the same ID, so bet placement can always re-resolve selections. */
export function stableSelId(fixtureSeed: string, marketName: string, label: string): string {
  const h = hashString(`${fixtureSeed}|${marketName}|${label}`);
  return `s-${(h >>> 0).toString(36)}`;
}

export function stableMktId(fixtureSeed: string, marketName: string): string {
  const h = hashString(`${fixtureSeed}|${marketName}`);
  return `m-${(h >>> 0).toString(36)}`;
}

export function buildMarketsForFixture(seed: string): Market[] {
  function sel(marketName: string, label: string, odds: number, extra?: Partial<Selection>): Selection {
    return { id: stableSelId(seed, marketName, label), label, odds, ...extra };
  }
  function market(name: string, tab: MarketTabKey, selections: Selection[], info?: string): Market {
    return { id: stableMktId(seed, name), name, tab, selections, info };
  }

  const rng = createRng(seed);
  const bias = rng.pick(["home", "balanced", "away"] as const);

  const homeOdds =
    bias === "home" ? rng.odds(1.3, 2.1) : bias === "away" ? rng.odds(3.2, 7.5) : rng.odds(2.0, 3.4);
  const awayOdds =
    bias === "away" ? rng.odds(1.3, 2.1) : bias === "home" ? rng.odds(3.2, 7.5) : rng.odds(2.0, 3.4);
  const drawOdds = rng.odds(2.9, 4.6);

  const markets: Market[] = [];

  // --- Main ---
  markets.push(market("1X2", "main", [sel("1X2", "Home", homeOdds), sel("1X2", "Draw", drawOdds), sel("1X2", "Away", awayOdds)]));
  markets.push(
    market("Double Chance", "main", [
      sel("Double Chance", "Home or Draw", Math.round((1 / (1 / homeOdds + 1 / drawOdds)) * 100) / 100),
      sel("Double Chance", "Home or Away", Math.round((1 / (1 / homeOdds + 1 / awayOdds)) * 100) / 100),
      sel("Double Chance", "Draw or Away", Math.round((1 / (1 / drawOdds + 1 / awayOdds)) * 100) / 100),
    ])
  );
  markets.push(
    market("Both Teams To Score", "main", [sel("Both Teams To Score", "Yes", rng.odds(1.6, 2.3)), sel("Both Teams To Score", "No", rng.odds(1.5, 2.1))])
  );
  markets.push(
    market("Draw No Bet", "main", [sel("Draw No Bet", "Home", rng.odds(1.1, 1.9)), sel("Draw No Bet", "Away", rng.odds(1.1, 4.5))])
  );
  for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    const overBase = line <= 1.5 ? rng.odds(1.02, 1.4) : rng.odds(1.6, 2.6);
    const underBase = line <= 1.5 ? rng.odds(3.5, 11) : rng.odds(1.5, 2.4);
    const mName = `Total ${line}`;
    markets.push(market(mName, "main", [sel(mName, `Over ${line}`, overBase), sel(mName, `Under ${line}`, underBase)]));
  }
  for (const label of ["-1 -1", "+1 +1", "+2 +2"] as const) {
    const mName = `3 Way Handicap ${label}`;
    markets.push(
      market(mName, "main", [
        sel(mName, "Home", rng.odds(1.4, 5)),
        sel(mName, "Draw", rng.odds(2.8, 4.2)),
        sel(mName, "Away", rng.odds(1.4, 5)),
      ])
    );
  }
  markets.push(market("Odd/even", "main", [sel("Odd/even", "Odd", rng.odds(1.75, 2.05)), sel("Odd/even", "Even", rng.odds(1.75, 2.05))]));

  // --- Goals ---
  markets.push(
    market("Total Goals Odd/Even", "goals", [sel("Total Goals Odd/Even", "Odd", rng.odds(1.75, 2.05)), sel("Total Goals Odd/Even", "Even", rng.odds(1.75, 2.05))])
  );
  // "First Team To Score" was removed: settlement only ever receives the final
  // (and halftime) score, never a goal timeline, so it could never be graded —
  // every bet on it silently refunded the stake and, inside an accumulator,
  // collapsed that leg's odds to 1.0. See isSettleableMarket() in
  // lib/settlement/resolve-leg.ts and the assertion at the bottom of this file.
  markets.push(
    market("Home Team Total Goals Over/Under 1.5", "goals", [
      sel("Home Team Total Goals Over/Under 1.5", "Over 1.5", rng.odds(1.8, 2.6)),
      sel("Home Team Total Goals Over/Under 1.5", "Under 1.5", rng.odds(1.4, 2.0)),
    ])
  );
  markets.push(
    market("Away Team Total Goals Over/Under 1.5", "goals", [
      sel("Away Team Total Goals Over/Under 1.5", "Over 1.5", rng.odds(1.8, 2.6)),
      sel("Away Team Total Goals Over/Under 1.5", "Under 1.5", rng.odds(1.4, 2.0)),
    ])
  );

  // --- Half ---
  markets.push(
    market("1st Half Result", "half", [sel("1st Half Result", "Home", rng.odds(1.9, 3.2)), sel("1st Half Result", "Draw", rng.odds(1.9, 2.4)), sel("1st Half Result", "Away", rng.odds(2.4, 4.4))])
  );
  markets.push(
    market("2nd Half Result", "half", [sel("2nd Half Result", "Home", rng.odds(1.9, 3.2)), sel("2nd Half Result", "Draw", rng.odds(1.9, 2.4)), sel("2nd Half Result", "Away", rng.odds(2.4, 4.4))])
  );
  markets.push(
    market("Half With Most Goals", "half", [
      sel("Half With Most Goals", "1st Half", rng.odds(2.0, 2.6)),
      sel("Half With Most Goals", "2nd Half", rng.odds(1.7, 2.1)),
      sel("Half With Most Goals", "Equal", rng.odds(3.2, 4.2)),
    ])
  );

  // --- Correct Score ---
  const correctScoreSelections: Selection[] = [];
  for (let home = 0; home <= 4; home++) {
    for (let away = 0; away <= 4; away++) {
      const diff = home - away;
      const biasPenalty =
        bias === "home" ? Math.max(0, -diff) * 0.9 : bias === "away" ? Math.max(0, diff) * 0.9 : Math.abs(diff) * 0.4;
      const raw = 4 + (home + away) * 2.1 + biasPenalty + rng.float(-1, 1.5);
      correctScoreSelections.push(sel("Correct Score", `${home}:${away}`, Math.min(100, Math.round(raw * 100) / 100)));
    }
  }
  correctScoreSelections.push(sel("Correct Score", "Other", rng.odds(15, 22)));
  markets.push(market("Correct Score", "main", correctScoreSelections));

  // --- Corners / Cards ---
  // Both tabs were removed entirely ("Total Corners Over/Under 9.5", "Corners
  // 3 Way", "Total Cards Over/Under 3.5", "Any Red Card"). Neither ilotbet's
  // feed nor the admin simulation gives us corner or card counts, so these
  // could never be graded — they always refunded. components/odds/market-tabs.tsx
  // renders only tabs that have content, so the tabs simply disappear rather
  // than showing empty. Restore them the day a corners/cards data source exists
  // AND resolve-leg.ts can grade them — the assertion below enforces that order.

  // --- Intervals (HT/FT) ---
  markets.push(
    market(
      "HT/FT",
      "intervals",
      ["1/1", "1/X", "1/2", "X/1", "X/X", "X/2", "2/1", "2/X", "2/2"].map((label) =>
        sel("HT/FT", label, label.includes("X") && !label.startsWith("X") ? rng.odds(8, 20) : rng.odds(3.5, 26))
      )
    )
  );

  // --- Specials ---
  markets.push(
    market("Winning Margin", "specials", [
      sel("Winning Margin", "Home by 1", rng.odds(4, 6)),
      sel("Winning Margin", "Home by 2+", rng.odds(4.5, 8)),
      sel("Winning Margin", "Draw", drawOdds),
      sel("Winning Margin", "Away by 1", rng.odds(5, 8)),
      sel("Winning Margin", "Away by 2+", rng.odds(6, 12)),
    ])
  );

  assertAllMarketsSettleable(markets);
  return markets;
}

/**
 * Hard guarantee that we never list a market settlement can't grade.
 *
 * This is the invariant that was missing when 11 sellable markets (corners,
 * cards, handicaps, half results, first-team-to-score) all fell through
 * resolveLegResult()'s catch-all and silently refunded every stake — and, worse,
 * collapsed those legs to odds 1.0 inside accumulators, quietly paying out far
 * less than the potential win the player was shown.
 *
 * Runs once per fixture build rather than as a test so it holds for markets
 * built at runtime too. Throwing is deliberate and is the safe direction: a
 * fixture that fails to build is a loud, immediate bug, whereas shipping an
 * ungradeable market is a silent one that only surfaces as a payout complaint
 * days later.
 */
function assertAllMarketsSettleable(markets: Market[]): void {
  const ungradeable = markets.filter((m) => !isSettleableMarket(m.name));
  if (ungradeable.length > 0) {
    throw new Error(
      `market-builder emitted market(s) settlement cannot grade: ${ungradeable.map((m) => m.name).join(", ")}. ` +
        `Either add a resolver in lib/settlement/resolve-leg.ts (and list it in SETTLEABLE_MARKET_NAMES), or don't sell it.`
    );
  }
}

/** Replace named markets' selections with real API odds, preserving stable
 * IDs. The optional 3rd tuple element is a suspended flag (only /odds/live
 * — the in-play endpoint — ever sets it; pre-match odds have no concept of
 * a mid-match suspension) — passed through to Selection.suspended, which
 * components/odds/odds-button.tsx already renders as a locked selection. */
export function overrideMarkets(
  fixtureSeed: string,
  markets: Market[],
  overrides: Record<string, Array<[string, number, boolean?]>>
): Market[] {
  return markets.map((m) => {
    const values = overrides[m.name];
    if (!values) return m;
    return {
      ...m,
      selections: values.map(([label, odds, suspended]) => ({
        id: stableSelId(fixtureSeed, m.name, label),
        label,
        odds,
        ...(suspended ? { suspended: true } : {}),
      })),
    };
  });
}
