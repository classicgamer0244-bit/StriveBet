import type { IlotbetMarketRaw, IlotbetOddRaw } from "./types";

type OddsRow = [string, number, boolean?];
type OddsOverrides = Record<string, OddsRow[]>;

function parseSpecifiers(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds the odds rows for one market from an id -> our-label map. Keys on
 * `odds[].id` — confirmed the stable field during planning (unlike `hname`,
 * which is sometimes absent even on an outcome of a market type that has it
 * elsewhere in the same payload). Returns null — leaving the market on its
 * RNG/fallback baseline rather than showing an incomplete one — if any
 * recognized-id outcome is missing a price (confirmed to happen: a
 * suspended, `"active": 0` row can omit the `odds` field entirely).
 */
function buildRows(odds: IlotbetOddRaw[], idToLabel: Record<string, string>): OddsRow[] | null {
  const rows: OddsRow[] = [];
  let recognized = 0;
  for (const o of odds) {
    const label = idToLabel[o.id];
    if (!label) continue;
    recognized++;
    if (typeof o.odds !== "number") return null;
    rows.push(o.active === 0 ? [label, o.odds, true] : [label, o.odds]);
  }
  return recognized > 0 ? rows : null;
}

const SIMPLE_ID_LABELS: Record<number, Record<string, string>> = {
  // 1x2
  1: { "1": "Home", "2": "Draw", "3": "Away" },
  // Both teams to score
  29: { "74": "Yes", "76": "No" },
  // Double chance
  10: { "9": "Home or Draw", "10": "Home or Away", "11": "Draw or Away" },
  // Draw no bet
  11: { "4": "Home", "5": "Away" },
};

const SIMPLE_ID_MARKET_NAMES: Record<number, string> = {
  1: "1X2",
  29: "Both Teams To Score",
  10: "Double Chance",
  11: "Draw No Bet",
};

/** marketId 26, Odd/even — the one real source feeds TWO of our market
 * slots ("Odd/even" and "Total Goals Odd/Even" are the same bet on our
 * platform, split into two named markets by data/mock/market-builder.ts). */
const ODD_EVEN_ID_LABELS: Record<string, string> = { "70": "Odd", "72": "Even" };

/** marketId 19 = Home Total, 20 = Away Total — distinguished by marketId,
 * not by parsing the team name out of `name` (which is "{TeamName} total"). */
const TEAM_TOTAL_MARKET_NAMES: Record<number, string> = {
  19: "Home Team Total Goals Over/Under 1.5",
  20: "Away Team Total Goals Over/Under 1.5",
};

/**
 * Maps ilotbet's raw markets for one match into the
 * `Record<marketName, Array<[label, odds, suspended?]>>` shape
 * data/mock/market-builder.ts's overrideMarkets() already accepts — same
 * mechanism the api-football integration used, just fed by a different
 * source. Confirmed mapping only (see the plan) — anything not handled here
 * (Handicap, Correct Score, and everything only the match-detail endpoint's
 * ~55 extra markets carry) is left on the RNG baseline rather than guessed.
 */
export function mapIlotbetMarketsToOverrides(markets: IlotbetMarketRaw[]): OddsOverrides {
  const overrides: OddsOverrides = {};

  for (const m of markets) {
    if (m.marketId in SIMPLE_ID_LABELS) {
      const rows = buildRows(m.odds, SIMPLE_ID_LABELS[m.marketId]);
      if (rows) overrides[SIMPLE_ID_MARKET_NAMES[m.marketId]] = rows;
      continue;
    }

    if (m.marketId === 26) {
      const rows = buildRows(m.odds, ODD_EVEN_ID_LABELS);
      if (rows) {
        overrides["Odd/even"] = rows;
        overrides["Total Goals Odd/Even"] = rows;
      }
      continue;
    }

    if (m.marketId === 18) {
      // Total — specifiers.total carries the line (e.g. "2.5"); our market
      // name/labels embed it the same way data/mock/market-builder.ts does.
      const specifiers = parseSpecifiers(m.specifiers);
      const line = specifiers?.total;
      if (!line) continue;
      const rows = buildRows(m.odds, { "12": `Over ${line}`, "13": `Under ${line}` });
      if (rows) overrides[`Total ${line}`] = rows;
      continue;
    }

    if (m.marketId === 19 || m.marketId === 20) {
      // Home/Away Total — our platform only prices the 1.5 line per team.
      const specifiers = parseSpecifiers(m.specifiers);
      if (specifiers?.total !== "1.5") continue;
      const rows = buildRows(m.odds, { "12": "Over 1.5", "13": "Under 1.5" });
      if (rows) overrides[TEAM_TOTAL_MARKET_NAMES[m.marketId]] = rows;
      continue;
    }
  }

  return overrides;
}
