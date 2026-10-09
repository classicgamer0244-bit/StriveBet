import { ilotbetGet, ILOTBET_SPORT_ID } from "../client";
import { isTerminalStatus } from "../status";
import { mapIlotbetMarketsToOverrides } from "../mapper";
import { upsertFixtureFacts, upsertListMarkets, markFixturesDropped } from "../cache/write";
import { getCachedEventStatuses, getCachedLiveMatchIds } from "../cache/read";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import { buildMarketsForFixture, overrideMarkets } from "@/data/mock/market-builder";
import { DETAIL_MARKETS_TTL_LIVE_MS } from "../constants";
import { toFacts, dedupeRawByMatchId } from "./raw-to-facts";
import type { IlotbetLiveMatchesResponse } from "../types";

/**
 * One request, unfiltered — every in-play real fixture across the whole
 * platform, in a single call regardless of how many players are online.
 * This is also the SOLE settlement trigger for ilotbet-sourced fixtures: it
 * diffs each match's previously-cached eventStatus against the fresh one and
 * settles anything that just crossed into a terminal state, so a bet
 * settles within one job cycle (~25s) of full time.
 *
 * ilotbet gives no explicit "finished" event — a match simply stops being
 * listed in /live/matches the instant it ends. So alongside the normal
 * present-in-response diff, this also sweeps for the opposite case: a
 * matchId cached as "live" that's now ABSENT from the fresh response. That's
 * ilotbet's only signal that the match just ended, and without catching it
 * here the cache row is never revisited again (frozen at eventStatus="live"
 * indefinitely) and any bet on it never settles — there's no separate
 * bet-fixtures sweeper for ilotbet the way api-football has one.
 */
export async function syncLiveMatches(): Promise<{ upserted: number; inPlay: number; terminal: number; dropped: number }> {
  const data = await ilotbetGet<IlotbetLiveMatchesResponse>("/api/sbu/un/m/live/matches", { sportId: ILOTBET_SPORT_ID });
  const raw = dedupeRawByMatchId(data.data?.matchList ?? []);

  // Sweep runs regardless of whether raw is empty — a quiet cycle with zero
  // live matches globally must not skip noticing that everything PREVIOUSLY
  // live just ended.
  const rawIds = new Set(raw.map((m) => m.matchId));
  // Football only: this response only ever lists football, so a live
  // basketball/tennis/… match is naturally absent from it and must not be
  // mistaken for one that just ended. Other sports run the same diff against
  // their own responses in ./other-sports.ts.
  const previouslyLiveIds = await getCachedLiveMatchIds("football");
  const droppedIds = previouslyLiveIds.filter((id) => !rawIds.has(id));
  if (droppedIds.length > 0) {
    await markFixturesDropped(droppedIds);
  }

  if (raw.length === 0) {
    if (droppedIds.length > 0) await settleBetsForFixtures(droppedIds);
    return { upserted: 0, inPlay: 0, terminal: droppedIds.length, dropped: droppedIds.length };
  }

  const matchIds = raw.map((m) => m.matchId);
  const previousStatus = await getCachedEventStatuses(matchIds);

  await upsertFixtureFacts(raw.map(toFacts), "live");

  const marketRows = raw
    .filter((m) => m.markets.length > 0)
    .map((m) => ({
      matchId: m.matchId,
      markets: overrideMarkets(m.matchId, buildMarketsForFixture(m.matchId), mapIlotbetMarketsToOverrides(m.markets)),
    }));
  await upsertListMarkets(marketRows, DETAIL_MARKETS_TTL_LIVE_MS);

  const terminalIds = raw
    .filter((m) => {
      const prev = previousStatus.get(m.matchId);
      const wasAlreadyTerminal = prev ? isTerminalStatus(prev) : false;
      return !wasAlreadyTerminal && isTerminalStatus(m.eventStatus);
    })
    .map((m) => m.matchId);

  const allTerminalIds = [...terminalIds, ...droppedIds];
  if (allTerminalIds.length > 0) {
    await settleBetsForFixtures(allTerminalIds);
  }

  return { upserted: raw.length, inPlay: raw.length, terminal: allTerminalIds.length, dropped: droppedIds.length };
}
