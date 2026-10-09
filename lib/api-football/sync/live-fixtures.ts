import { db } from "@/lib/db";
import { apiFootballGet } from "../client";
import { isTerminalStatus } from "../status";
import { upsertFixtureFacts, type ApiFixtureFactsUpsert } from "../cache/write";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import { toLegacyApiFootballFixtureId } from "@/lib/fixture-id";
import type { ApiFootballFixtureRaw, ApiFootballFixturesResponse } from "../types";

/** api-football can return the same fixture id more than once within a
 * response (observed in practice) — de-duplicate before mapping. */
function dedupeRawById(raw: ApiFootballFixtureRaw[]): ApiFootballFixtureRaw[] {
  const seen = new Set<number>();
  const out: ApiFootballFixtureRaw[] = [];
  for (const f of raw) {
    if (seen.has(f.fixture.id)) continue;
    seen.add(f.fixture.id);
    out.push(f);
  }
  return out;
}

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

/**
 * One request, `/fixtures?live=all` — every in-play real fixture across the
 * whole platform, in a single call regardless of how many players are
 * online. This is also the PRIMARY settlement trigger for real fixtures: it
 * diffs each fixture's previously-cached status against the fresh one and
 * settles anything that just crossed into a terminal state (finished OR
 * void — see lib/api-football/status.ts), so a bet settles within one
 * job cycle of full time, driven by the clock rather than by whether some
 * user happens to have the my-bets SSE stream open.
 */
export async function syncLiveFixtures(): Promise<{ upserted: number; inPlay: number; terminal: number }> {
  const data = await apiFootballGet<ApiFootballFixturesResponse>("/fixtures", { live: "all" }, "listings");
  const raws = dedupeRawById(data.response);
  if (raws.length === 0) return { upserted: 0, inPlay: 0, terminal: 0 };

  const ids = raws.map((r) => r.fixture.id);
  const previous = await db.apiFixtureCache.findMany({
    where: { apiFixtureId: { in: ids } },
    select: { apiFixtureId: true, statusShort: true },
  });
  const previousStatus = new Map(previous.map((p) => [p.apiFixtureId, p.statusShort]));

  await upsertFixtureFacts(raws.map(toFacts), "live");

  const terminalIds = raws
    .filter((r) => {
      const prevStatus = previousStatus.get(r.fixture.id);
      const wasAlreadyTerminal = prevStatus ? isTerminalStatus(prevStatus) : false;
      return !wasAlreadyTerminal && isTerminalStatus(r.fixture.status.short);
    })
    .map((r) => toLegacyApiFootballFixtureId(r.fixture.id));

  if (terminalIds.length > 0) {
    await settleBetsForFixtures(terminalIds);
  }

  return { upserted: raws.length, inPlay: raws.length, terminal: terminalIds.length };
}
