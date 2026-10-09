import type { IlotbetFixtureCache, Prisma } from "@prisma/client";
import { isSettleableMarket } from "@/lib/settlement/resolve-leg";
import { mapEventStatus, formatMinute, formatPeriodLabel } from "../status";
import { sportSlugFromIlotbetId } from "../sports";
import { fallbackMarkets } from "../sport-markets";
import type { Fixture, Market, Team } from "@/types";

/**
 * IlotbetFixtureCache <-> our shared Fixture/Market shapes — mirrors
 * lib/api-football/cache/model.ts's role exactly (the ONE place that
 * reads/writes the cache's markets/listMarkets JSON columns).
 */

const MARKETS_ENVELOPE_VERSION = 1;

/** Markets a list ROW actually renders — same set fixture-row.tsx/
 * mobile-fixture-row.tsx read regardless of data source. */
const LIST_MARKET_NAMES = new Set(["1X2", "Total 0.5", "Total 1.5", "Total 2.5", "Total 3.5", "Total 4.5"]);

export function serializeMarkets(markets: Market[]): Prisma.InputJsonValue {
  return { v: MARKETS_ENVELOPE_VERSION, markets } as unknown as Prisma.InputJsonValue;
}

export function serializeListMarkets(markets: Market[]): Prisma.InputJsonValue {
  return serializeMarkets(markets.filter((m) => LIST_MARKET_NAMES.has(m.name)));
}

export function deserializeMarkets(value: Prisma.JsonValue | null | undefined): Market[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const envelope = value as { v?: number; markets?: unknown };
  if (!Array.isArray(envelope.markets)) return undefined;
  return envelope.markets as Market[];
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function shortName(name: string): string {
  return name.length <= 12 ? name : name.slice(0, 12);
}

function toTeam(name: string, logoUrl?: string | null): Team {
  return { id: slugify(name), name, shortName: shortName(name), logoUrl: logoUrl ?? undefined };
}

/** The subset of IlotbetFixtureCache's columns needed to build a Fixture —
 * every read query selects at least this much. */
export type IlotbetFixtureCacheRow = Pick<
  IlotbetFixtureCache,
  | "matchId"
  | "numericId"
  | "eventStatus"
  | "periodDesc"
  | "takeUpTime"
  | "scheduledTime"
  | "categoryId"
  | "categoryName"
  | "tournamentId"
  | "tournamentName"
  | "tournamentIcon"
  | "homeName"
  | "homeLogo"
  | "awayName"
  | "awayLogo"
  | "homeScore"
  | "awayScore"
  | "markets"
  | "fetchedAt"
  | "sportId"
>;

/** A cache row -> the shared Fixture shape every page/component renders.
 * `markets` falls back to the deterministic RNG baseline when the row has
 * never been priced — the fixture is never shown with an empty market list.
 * List pages and the detail page call this on the SAME cached row, so they
 * can no longer disagree. */
export function toFixture(row: IlotbetFixtureCacheRow): Fixture {
  const id = row.matchId;
  const sportSlug = sportSlugFromIlotbetId(row.sportId);
  // Filtered on read: `markets` is a cached JSON blob, so a row priced before a
  // market was withdrawn from sale keeps serving it until the next sync
  // rewrites it. Bet placement already rejects those markets, so without this
  // we'd render a price we would then refuse to accept. Freshly-built markets
  // are already clean (market-builder asserts it), making this a no-op for them.
  const markets = (deserializeMarkets(row.markets) ?? fallbackMarkets(id, sportSlug)).filter((m) =>
    isSettleableMarket(m.name)
  );

  return {
    id,
    gameId: row.numericId !== null && row.numericId !== undefined ? String(row.numericId) : (id.split(":").pop() ?? id),
    sportSlug,
    leagueId: row.tournamentId ?? row.categoryId ?? "unknown",
    leagueName: row.tournamentName,
    leagueLogo: row.tournamentIcon ?? undefined,
    kickoffAt: row.scheduledTime.toISOString(),
    status: mapEventStatus(row.eventStatus),
    homeTeam: toTeam(row.homeName, row.homeLogo),
    awayTeam: toTeam(row.awayName, row.awayLogo),
    score:
      row.homeScore !== null && row.homeScore !== undefined && row.awayScore !== null && row.awayScore !== undefined
        ? { home: row.homeScore, away: row.awayScore }
        : undefined,
    minute:
      sportSlug === "football"
        ? formatMinute(row.takeUpTime, row.periodDesc, row.eventStatus, row.fetchedAt)
        : formatPeriodLabel(row.periodDesc, row.eventStatus),
    markets,
  };
}
