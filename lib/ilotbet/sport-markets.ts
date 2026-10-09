import { buildMarketsForFixture, overrideMarkets, stableMktId, stableSelId } from "@/data/mock/market-builder";
import { isSettleableMarket } from "@/lib/settlement/resolve-leg";
import { mapIlotbetMarketsToOverrides } from "./mapper";
import type { IlotbetMarketRaw, IlotbetOddRaw } from "./types";
import type { Market, Selection, SportSlug } from "@/types";

/**
 * Raw ilotbet markets -> our Market list, per sport. Client-safe (pure) — used
 * by the backend sync jobs, the match-detail fetch and the browser fetch path,
 * so all three always build identical market/selection ids for the same match.
 *
 * Football keeps its long-standing behaviour exactly: the deterministic
 * baseline from data/mock/market-builder.ts with real ilotbet odds layered on
 * top.
 *
 * Every other sport gets ONLY markets ilotbet actually prices — never an RNG
 * baseline — and only the ones lib/settlement/resolve-leg.ts can grade from the
 * data we capture. The market names are distinct from football's on purpose so
 * a leg is always graded by its own sport's rules (e.g. basketball's winner
 * includes overtime; ice hockey's 1X2 is regulation time only).
 */

type Kind = "winner2" | "1x2" | "total";

interface MarketRule {
  kind: Kind;
  /** Our market name; `line` is the total's line for kind "total". */
  name: (line?: string) => string;
}

const WINNER_INCL_OT: MarketRule = { kind: "winner2", name: () => "Winner (incl. overtime)" };
const POINTS_TOTAL: MarketRule = { kind: "total", name: (line) => `Total Points ${line}` };

/** marketId -> rule, per sport. Ids confirmed against live ilotbet payloads. */
const SPORT_MARKET_RULES: Partial<Record<SportSlug, Record<number, MarketRule>>> = {
  basketball: { 219: WINNER_INCL_OT, 225: POINTS_TOTAL },
  "american-football": { 219: WINNER_INCL_OT, 225: POINTS_TOTAL },
  baseball: {
    251: { kind: "winner2", name: () => "Winner (incl. extra innings)" },
    258: { kind: "total", name: (line) => `Total Runs ${line}` },
  },
  tennis: { 186: { kind: "winner2", name: () => "Match Winner" } },
  "ice-hockey": {
    1: { kind: "1x2", name: () => "1X2 (Regular Time)" },
    18: { kind: "total", name: (line) => `Total Goals (Regular Time) ${line}` },
  },
};

/** ilotbet outcome id -> our selection label. */
const OUTCOME_LABELS: Record<Kind, (line?: string) => Record<string, string>> = {
  winner2: () => ({ "4": "Home", "5": "Away" }),
  "1x2": () => ({ "1": "Home", "2": "Draw", "3": "Away" }),
  total: (line) => ({ "12": `Over ${line}`, "13": `Under ${line}` }),
};

function parseLine(specifiers: string): string | undefined {
  try {
    const parsed = JSON.parse(specifiers) as { total?: string };
    return parsed?.total;
  } catch {
    return undefined;
  }
}

/** Null when any recognised outcome is missing a price — same rule as
 * ./mapper's buildRows: never list a half-priced market. */
function buildSelections(matchId: string, marketName: string, odds: IlotbetOddRaw[], labels: Record<string, string>): Selection[] | null {
  const selections: Selection[] = [];
  for (const o of odds) {
    const label = labels[o.id];
    if (!label) continue;
    if (typeof o.odds !== "number") return null;
    selections.push({
      id: stableSelId(matchId, marketName, label),
      label,
      odds: o.odds,
      ...(o.active === 0 ? { suspended: true } : {}),
    });
  }
  return selections.length === Object.keys(labels).length ? selections : null;
}

/** Sports with at least one bettable market mapping. */
export function hasBettableMarkets(sportSlug: SportSlug): boolean {
  return sportSlug === "football" || Boolean(SPORT_MARKET_RULES[sportSlug]);
}

export function buildIlotbetMarkets(matchId: string, sportSlug: SportSlug, raw: IlotbetMarketRaw[]): Market[] {
  if (sportSlug === "football") {
    return overrideMarkets(matchId, buildMarketsForFixture(matchId), mapIlotbetMarketsToOverrides(raw));
  }

  const rules = SPORT_MARKET_RULES[sportSlug];
  if (!rules) return [];

  const markets: Market[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    const rule = rules[m.marketId];
    if (!rule) continue;
    const line = rule.kind === "total" ? parseLine(m.specifiers) : undefined;
    if (rule.kind === "total" && !line) continue;
    const name = rule.name(line);
    if (seen.has(name) || !isSettleableMarket(name)) continue;
    const selections = buildSelections(matchId, name, m.odds, OUTCOME_LABELS[rule.kind](line));
    if (!selections) continue;
    seen.add(name);
    markets.push({ id: stableMktId(matchId, name), name, tab: "main", selections });
  }
  return markets;
}

/** Markets for a row with no stored markets yet: football's baseline, or
 * nothing at all for other sports (never invent prices for them). */
export function fallbackMarkets(matchId: string, sportSlug: SportSlug): Market[] {
  return sportSlug === "football" ? buildMarketsForFixture(matchId) : [];
}
