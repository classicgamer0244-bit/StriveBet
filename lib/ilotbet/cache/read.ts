import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toFixture } from "./model";
import { IN_PLAY_STATUSES, SCHEDULED_STATUSES, FINISHED_STATUSES, VOID_STATUSES, DROPPED_STATUS } from "../status";
import { ILOTBET_SPORT_IDS } from "../sports";
import type { Fixture, SportSlug } from "@/types";

/**
 * Restricts a query to one sport. Rows cached before multi-sport support have
 * no sportId and are all football, so football also matches a missing value
 * (Mongo distinguishes "absent" from "null" — both are covered). Undefined =
 * every sport.
 */
export function sportWhere(sport: SportSlug | undefined): Prisma.IlotbetFixtureCacheWhereInput {
  if (!sport) return {};
  const sportId = ILOTBET_SPORT_IDS[sport];
  if (sport !== "football") return { sportId };
  return { OR: [{ sportId }, { sportId: null }, { sportId: { isSet: false } }] };
}

/** Every list/detail read selects at least this much — matches
 * IlotbetFixtureCacheRow in ./model.ts, plus the two freshness fields
 * getRealFixtureById() needs to decide whether an on-demand detail fetch is
 * warranted. */
const FIXTURE_SELECT = {
  matchId: true,
  numericId: true,
  eventStatus: true,
  periodDesc: true,
  takeUpTime: true,
  scheduledTime: true,
  categoryId: true,
  categoryName: true,
  tournamentId: true,
  tournamentName: true,
  tournamentIcon: true,
  homeName: true,
  homeLogo: true,
  awayName: true,
  awayLogo: true,
  homeScore: true,
  awayScore: true,
  sportId: true,
  markets: true,
  marketsSource: true,
  detailFetchedAt: true,
  fetchedAt: true,
} as const;

export async function getCachedLiveFixtures(limit: number, sport?: SportSlug): Promise<Fixture[]> {
  const rows = await db.ilotbetFixtureCache.findMany({
    where: { AND: [{ eventStatus: { in: [...IN_PLAY_STATUSES] } }, sportWhere(sport)] },
    orderBy: { scheduledTime: "asc" },
    take: limit,
    select: FIXTURE_SELECT,
  });
  return rows.map(toFixture);
}

export async function getCachedUpcomingFixtures(limit: number, sport?: SportSlug): Promise<Fixture[]> {
  const rows = await db.ilotbetFixtureCache.findMany({
    where: { AND: [{ eventStatus: { in: [...SCHEDULED_STATUSES] }, scheduledTime: { gt: new Date() } }, sportWhere(sport)] },
    orderBy: { scheduledTime: "asc" },
    take: limit,
    select: FIXTURE_SELECT,
  });
  return rows.map(toFixture);
}

export async function getCachedFixturesByTournament(tournamentId: string): Promise<Fixture[]> {
  const now = new Date();
  const rows = await db.ilotbetFixtureCache.findMany({
    where: {
      tournamentId,
      OR: [{ eventStatus: { in: [...IN_PLAY_STATUSES] } }, { eventStatus: { in: [...SCHEDULED_STATUSES] }, scheduledTime: { gt: now } }],
    },
    orderBy: { scheduledTime: "asc" },
    select: FIXTURE_SELECT,
  });
  return rows.map(toFixture);
}

export interface CachedFixtureRow {
  fixture: Fixture;
  marketsSource: string | null;
  detailFetchedAt: Date | null;
}

export async function getCachedFixtureByMatchId(matchId: string): Promise<CachedFixtureRow | undefined> {
  const row = await db.ilotbetFixtureCache.findUnique({ where: { matchId }, select: FIXTURE_SELECT });
  if (!row) return undefined;
  return { fixture: toFixture(row), marketsSource: row.marketsSource, detailFetchedAt: row.detailFetchedAt };
}

export interface CachedFixtureState {
  matchId: string;
  eventStatus: string;
  takeUpTime: number | null;
  periodDesc: string | null;
  scheduledTime: Date;
  fetchedAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  halftimeHomeScore: number | null;
  halftimeAwayScore: number | null;
  regulationHomeScore: number | null;
  regulationAwayScore: number | null;
  sportId: string | null;
}

/** Batch form for the per-user paths (lib/bets/fixture-state.ts,
 * lib/settlement/fixture-lookup.ts) — one query regardless of how many
 * fixture ids are asked for. */
export async function getCachedFixtureStates(matchIds: string[]): Promise<Map<string, CachedFixtureState>> {
  if (matchIds.length === 0) return new Map();
  const rows = await db.ilotbetFixtureCache.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      eventStatus: true,
      takeUpTime: true,
      periodDesc: true,
      scheduledTime: true,
      fetchedAt: true,
      homeScore: true,
      awayScore: true,
      halftimeHomeScore: true,
      halftimeAwayScore: true,
      regulationHomeScore: true,
      regulationAwayScore: true,
      sportId: true,
    },
  });
  return new Map(rows.map((r) => [r.matchId, r]));
}

/** Every matchId currently cached as in-play — the "previously live" side of
 * syncLiveMatches()'s dropped-fixture diff (a match absent from the fresh
 * /live/matches response but still marked live here just vanished from
 * ilotbet's feed, which is how ilotbet signals "finished": no explicit
 * event, the match just stops being listed). */
export async function getCachedLiveMatchIds(sport?: SportSlug): Promise<string[]> {
  const rows = await db.ilotbetFixtureCache.findMany({
    where: { AND: [{ eventStatus: { in: [...IN_PLAY_STATUSES] } }, sportWhere(sport)] },
    select: { matchId: true },
  });
  return rows.map((r) => r.matchId);
}

/**
 * Match ids whose cached status must NOT be downgraded by the low-frequency
 * daily sync.
 *
 * syncDailyMatches() writes eventStatus unconditionally for everything
 * /pre/matches returns, and that endpoint keeps listing a fixture for the rest
 * of its date window even after it has kicked off or finished. Excluding only
 * currently-live ids (as it used to) meant a fixture already recorded as
 * finished/void/dropped was silently reverted to "not_started" on the next
 * 10-minute cycle — un-settling bets that were seconds away from settling, over
 * and over. Anything past "scheduled" is protected here.
 */
export async function getNonDowngradableMatchIds(): Promise<string[]> {
  const rows = await db.ilotbetFixtureCache.findMany({
    where: {
      eventStatus: { in: [...IN_PLAY_STATUSES, ...FINISHED_STATUSES, ...VOID_STATUSES, DROPPED_STATUS] },
    },
    select: { matchId: true },
  });
  return rows.map((r) => r.matchId);
}

/** matchId -> eventStatus only, for the terminal-transition diff the
 * daily/live-matches syncs use to decide which fixtures just finished. */
export async function getCachedEventStatuses(matchIds: string[]): Promise<Map<string, string>> {
  if (matchIds.length === 0) return new Map();
  const rows = await db.ilotbetFixtureCache.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, eventStatus: true },
  });
  return new Map(rows.map((r) => [r.matchId, r.eventStatus]));
}

/** Sidebar/A-Z league data, straight from the cache — no ilotbet calls. Group
 * granularity is TOURNAMENT (e.g. "UEFA Europa Conference League"), the
 * closer analog to api-football's per-league grouping; ilotbet's broader
 * `categoryName` (e.g. "International Clubs") is closer to a country/region
 * grouping than a league. */
export async function getCachedLeagueCounts(): Promise<
  Array<{ tournamentId: string; tournamentName: string; tournamentIcon: string | null; sportId: string | null; count: number }>
> {
  const now = new Date();
  const where: Prisma.IlotbetFixtureCacheWhereInput = {
    tournamentId: { not: null },
    OR: [{ eventStatus: { in: [...IN_PLAY_STATUSES] } }, { eventStatus: { in: [...SCHEDULED_STATUSES] }, scheduledTime: { gt: now } }],
  };
  // sportId is deliberately NOT a groupBy key: rows cached before multi-sport
  // support have no sportId field at all, and Prisma's MongoDB groupBy panics
  // (query-engine unwrap on None) when a grouping key is absent from some
  // documents. It's looked up per tournament with a plain distinct query.
  const [groups, sportRows] = await Promise.all([
    db.ilotbetFixtureCache.groupBy({
      by: ["tournamentId", "tournamentName", "tournamentIcon"],
      where,
      _count: { _all: true },
    }),
    db.ilotbetFixtureCache.findMany({
      where,
      select: { tournamentId: true, sportId: true },
      distinct: ["tournamentId"],
    }),
  ]);
  const sportByTournament = new Map(sportRows.map((r) => [r.tournamentId, r.sportId ?? null]));
  return groups
    .filter((g): g is typeof g & { tournamentId: string } => g.tournamentId !== null)
    .map((g) => ({
      tournamentId: g.tournamentId,
      tournamentName: g.tournamentName,
      tournamentIcon: g.tournamentIcon,
      sportId: sportByTournament.get(g.tournamentId) ?? null,
      count: g._count._all,
    }));
}
