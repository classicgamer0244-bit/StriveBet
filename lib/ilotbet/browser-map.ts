import { mapEventStatus, formatMinute, formatPeriodLabel } from "./status";
import { sportSlugFromIlotbetId } from "./sports";
import { buildIlotbetMarkets } from "./sport-markets";
import type { IlotbetMatchRaw } from "./types";
import type { Fixture, Team } from "@/types";

/**
 * Raw ilotbet match -> our shared Fixture shape, entirely client-safe (no
 * server-only imports — mapIlotbetMarketsToOverrides/mapEventStatus/
 * formatMinute/buildMarketsForFixture are all pure functions with zero
 * Node/DB dependencies). This is the browser counterpart to
 * lib/ilotbet/cache/model.ts's toFixture(): that one builds a Fixture from a
 * cached DB row, this one builds it directly from ilotbet's own API
 * response, for lib/ilotbet/browser-fetch.ts's direct-from-the-browser
 * fetches — no backend round trip in between.
 */

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function shortName(name: string): string {
  return name.length <= 12 ? name : name.slice(0, 12);
}

function toTeam(name: string, logoUrl?: string): Team {
  return { id: slugify(name), name, shortName: shortName(name), logoUrl: logoUrl || undefined };
}

export function rawIlotbetMatchToFixture(raw: IlotbetMatchRaw): Fixture {
  const id = raw.matchId;
  const sportSlug = sportSlugFromIlotbetId(raw.sportId);
  // Same builder the server uses, so selection ids always match what bet
  // placement re-resolves against.
  const markets = buildIlotbetMarkets(id, sportSlug, raw.markets ?? []);

  return {
    id,
    gameId: raw.id !== undefined && raw.id !== null ? String(raw.id) : (id.split(":").pop() ?? id),
    sportSlug,
    leagueId: raw.tournamentId ?? raw.categoryId ?? "unknown",
    leagueName: raw.tournamentName,
    leagueLogo: raw.tournamentIcon || undefined,
    kickoffAt: new Date(raw.scheduledTime).toISOString(),
    status: mapEventStatus(raw.eventStatus),
    homeTeam: toTeam(raw.homeName, raw.homeLogo),
    awayTeam: toTeam(raw.awayName, raw.awayLogo),
    score: raw.homeScore !== undefined && raw.awayScore !== undefined ? { home: raw.homeScore, away: raw.awayScore } : undefined,
    minute:
      sportSlug === "football"
        ? formatMinute(raw.takeUpTime, raw.periodDesc, raw.eventStatus)
        : formatPeriodLabel(raw.periodDesc, raw.eventStatus),
    markets,
  };
}
