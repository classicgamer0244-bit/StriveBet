import { db } from "@/lib/db";
import { apiFootballGet, chunk, isApiFootballConfigured, joinIds, MAX_IDS_PER_REQUEST } from "../client";
import { isTerminalStatus } from "../status";
import { upsertFixtureFacts, type ApiFixtureFactsUpsert } from "../cache/write";
import { getCachedStatusShorts } from "../cache/read";
import {
  fromLegacyApiFootballFixtureId,
  isLegacyApiFootballFixtureId,
  toLegacyApiFootballFixtureId,
} from "@/lib/fixture-id";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import type { ApiFootballFixtureRaw, ApiFootballFixturesResponse } from "../types";

const MAX_BET_FIXTURE_IDS = 100;
/** A fixture the 25s live sweep is already refreshing this recently never
 * qualifies here too — in-play fixtures cost this job nothing. */
const MIN_AGE_MS = 90_000;

function toFacts(raw: ApiFootballFixtureRaw): ApiFixtureFactsUpsert {
  return {
    apiFixtureId: raw.fixture.id,
    statusShort: raw.fixture.status.short,
    statusLong: raw.fixture.status.long,
    elapsed: raw.fixture.status.elapsed,
    kickoffAt: new Date(raw.fixture.date),
    leagueId: raw.league.id,
    leagueName: raw.league.name,
    leagueLogo: raw.league.logo,
    leagueCountry: raw.league.country,
    homeTeamId: raw.teams.home.id,
    homeTeamName: raw.teams.home.name,
    homeTeamLogo: raw.teams.home.logo,
    awayTeamId: raw.teams.away.id,
    awayTeamName: raw.teams.away.name,
    awayTeamLogo: raw.teams.away.logo,
    goalsHome: raw.goals.home,
    goalsAway: raw.goals.away,
  };
}

/** Distinct real-fixture ids referenced by any OPEN bet whose cached row is
 * either missing, or non-terminal and stale enough that the live sweep
 * hasn't covered it recently — a terminal row is DONE forever and is never
 * selected again, which is what makes this sweeper drain to zero rather
 * than repeatedly re-checking fixtures that already finished. */
async function selectStaleOpenBetFixtureIds(): Promise<number[]> {
  const openBets = await db.bet.findMany({ where: { status: "OPEN" }, select: { legs: true } });
  const distinctIds = [
    ...new Set(
      openBets
        .flatMap((b) => b.legs.map((l) => l.fixtureId))
        .filter(isLegacyApiFootballFixtureId)
        .map((id) => fromLegacyApiFootballFixtureId(id))
        .filter((id): id is number => id !== null)
    ),
  ];
  if (distinctIds.length === 0) return [];

  const cutoff = new Date(Date.now() - MIN_AGE_MS);
  const rows = await db.apiFixtureCache.findMany({
    where: { apiFixtureId: { in: distinctIds } },
    select: { apiFixtureId: true, statusShort: true, fetchedAt: true },
  });
  const byId = new Map(rows.map((r) => [r.apiFixtureId, r]));

  return distinctIds
    .filter((id) => {
      const row = byId.get(id);
      if (!row) return true;
      if (isTerminalStatus(row.statusShort)) return false;
      return row.fetchedAt < cutoff;
    })
    .slice(0, MAX_BET_FIXTURE_IDS);
}

/**
 * Sweeper for real fixtures with OPEN-bet money on them that the live sweep
 * (/fixtures?live=all) can't see — a fixture drops out of that list shortly
 * after FT, and one postponed before kickoff was never in it to begin with.
 * `?ids=` is chunked to api-football's documented 20-id cap — the missing
 * chunking in the old settleLiveBets() (a single unbounded `ids=` join) is
 * very likely why real-fixture bets sometimes went unsettled before this
 * file existed. `explicitIds`, when passed, bypasses selection entirely —
 * used by getFixtureById() for a fixture not yet in the cache at all.
 */
export async function syncBetFixtures(explicitIds?: number[]): Promise<{ fetched: number; terminal: number }> {
  if (!isApiFootballConfigured()) return { fetched: 0, terminal: 0 };

  const ids = explicitIds ?? (await selectStaleOpenBetFixtureIds());
  if (ids.length === 0) return { fetched: 0, terminal: 0 };

  const results = await Promise.all(
    chunk(ids, MAX_IDS_PER_REQUEST).map((c) =>
      apiFootballGet<ApiFootballFixturesResponse>("/fixtures", { ids: joinIds(c) }, "bets").catch(
        () => ({ response: [] as ApiFootballFixtureRaw[] })
      )
    )
  );
  const raw = results.flatMap((r) => r.response);
  if (raw.length === 0) return { fetched: 0, terminal: 0 };

  const previousStatuses = await getCachedStatusShorts(raw.map((f) => f.fixture.id));
  const terminal = raw.filter((f) => {
    const prev = previousStatuses.get(f.fixture.id);
    return isTerminalStatus(f.fixture.status.short) && prev !== f.fixture.status.short;
  });

  await upsertFixtureFacts(raw.map(toFacts), "ids");

  if (terminal.length > 0) {
    await settleBetsForFixtures(terminal.map((f) => toLegacyApiFootballFixtureId(f.fixture.id)));
  }

  return { fetched: raw.length, terminal: terminal.length };
}
