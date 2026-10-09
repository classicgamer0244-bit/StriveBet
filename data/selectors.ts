import { sports } from "./mock/sports";
import { winners } from "./mock/winners";
import { games, gameCategories } from "./mock/games";
import {
  getFixtureById as _getFixtureById,
  getFixturesByLeague as _getFixturesByLeague,
  getHighlightFixtures as _getHighlightFixtures,
  getLiveFixtures as _getLiveFixtures,
  getUpcomingFixtures as _getUpcomingFixtures,
  getAllLeaguesAZ as _getAllLeaguesAZ,
  getLeagueById as _getLeagueById,
  getPopularLeagues as _getPopularLeagues,
  getSidebarLeagues as _getSidebarLeagues,
} from "@/lib/fixtures";
import type { Fixture, SportSlug } from "@/types";

/**
 * Every page/component reads fixture/league data through this file, never
 * `lib/fixtures.ts`/`lib/api-football/*` directly — this is the single seam.
 * Fixture and league functions are async (real fixtures are fetched live
 * from api-football on every call, never persisted — see lib/fixtures.ts);
 * Server Components must `await` them. Client Components can't call these
 * directly — use the hooks/use-fixtures.ts fetch-based hooks instead.
 */

export function getHighlightFixtures(): Promise<Fixture[]> {
  return _getHighlightFixtures();
}

export function getLiveFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  return _getLiveFixtures(sportSlug);
}

export function getUpcomingFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  return _getUpcomingFixtures(sportSlug);
}

export function getFixtureById(id: string): Promise<Fixture | undefined> {
  return _getFixtureById(id);
}

export function getFixturesByLeague(leagueId: string): Promise<Fixture[]> {
  return _getFixturesByLeague(leagueId);
}

export function groupFixturesByLeague(
  list: Fixture[]
): Array<{ leagueId: string; leagueName: string; fixtures: Fixture[] }> {
  const order: string[] = [];
  const map = new Map<string, Fixture[]>();
  for (const f of list) {
    if (!map.has(f.leagueId)) {
      map.set(f.leagueId, []);
      order.push(f.leagueId);
    }
    map.get(f.leagueId)!.push(f);
  }
  return order.map((leagueId) => ({
    leagueId,
    leagueName: map.get(leagueId)![0].leagueName,
    fixtures: map.get(leagueId)!,
  }));
}

export function getSidebarLeagues() {
  return _getSidebarLeagues();
}

export function getPopularLeagues() {
  return _getPopularLeagues();
}

export function getAllLeaguesAZ() {
  return _getAllLeaguesAZ();
}

export function getLeagueById(id: string) {
  return _getLeagueById(id);
}

export function getSports() {
  return sports;
}

export function getGrandPrizeWinners() {
  return winners;
}

export function getGames() {
  return games;
}

export function getGameCategories() {
  return gameCategories;
}
