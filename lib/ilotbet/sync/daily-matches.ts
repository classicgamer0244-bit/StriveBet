import { db } from "@/lib/db";
import { ilotbetGet, ILOTBET_SPORT_ID } from "../client";
import { mapIlotbetMarketsToOverrides } from "../mapper";
import { upsertFixtureFacts, upsertListMarkets, pruneStaleFixtures } from "../cache/write";
import { getNonDowngradableMatchIds } from "../cache/read";
import { isRealFixtureId, fromRealFixtureId } from "../fixture-id";
import { buildMarketsForFixture, overrideMarkets } from "@/data/mock/market-builder";
import { DETAIL_MARKETS_TTL_MS } from "../constants";
import { toFacts, dedupeRawByMatchId } from "./raw-to-facts";
import type { IlotbetMatchRaw, IlotbetDailyMatchesResponse } from "../types";

/** How many days ahead to pull — today plus this many. */
const DAYS_AHEAD = 2;
/** One call already covers the whole window (unlike api-football's
 * per-day `date=` looping) — still capped so the stored row count and the
 * market-building work stay bounded regardless of how many fixtures exist
 * upstream in that window. */
const DAILY_CACHE_CAP = 300;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
/** Prune terminal rows once their kickoff is this old, unless an OPEN bet
 * still references them.
 *
 * 30 days, not 3: only OPEN bets protect a row, so a bet that has already
 * settled does NOT keep its own fixture alive. That row is the sole home of
 * halftimeHomeScore/halftimeAwayScore (BetLegEmbed freezes the final score at
 * settlement but not the halftime one), which is the only evidence that could
 * ever re-grade a half-market leg settled wrongly. At 3 days that evidence was
 * being destroyed faster than anyone could notice a grading bug. */
const PRUNE_OLDER_THAN_MS = 30 * 24 * 60 * 60_000;

function formatBoundary(date: Date): string {
  // ilotbet expects "+00:00", not the "Z" Date#toISOString() produces —
  // confirmed against the real endpoint's own st/et query params.
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDayUtc(daysFromNow: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 0);
  return d;
}

/**
 * No `matchCount` total anywhere in this response (unlike /live/matches —
 * see IlotbetDailyMatchesResponse's doc comment) — confirmed via direct
 * pagination probing that a page shorter than PAGE_SIZE means "no more
 * pages." `data.list` is a page of per-sport groups, not matches directly;
 * since only one sportId is ever queried, at most one entry.
 */
async function fetchAllPages(st: string, et: string): Promise<IlotbetMatchRaw[]> {
  const all: IlotbetMatchRaw[] = [];
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const res = await ilotbetGet<IlotbetDailyMatchesResponse>("/api/sbu/un/m/pre/matches", {
      sportId: ILOTBET_SPORT_ID,
      st,
      et,
      pageNum,
      pageSize: PAGE_SIZE,
    });
    const matches = res.data?.list?.[0]?.matchList ?? [];
    all.push(...matches);
    if (matches.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * "Upcoming/today" = today through +DAYS_AHEAD days, one call (with
 * defensive pagination) rather than api-football's one-call-per-day. Odds
 * are embedded in this SAME response — this job doubles as the odds refresh
 * for anything not currently live, so its 10-minute TTL can't be as slow as
 * api-football's old 3h-recommended pre-match-odds cadence.
 */
export async function syncDailyMatches(): Promise<{ upserted: number; pruned: number }> {
  const st = formatBoundary(startOfTodayUtc());
  const et = formatBoundary(endOfDayUtc(DAYS_AHEAD));

  const raw = await fetchAllPages(st, et);
  const deduped = dedupeRawByMatchId(raw);

  // /pre/matches is a schedule listing, not a live tracker — it keeps
  // reporting eventStatus "not_started" for matches that have long since
  // kicked off or finished, for the rest of their date window. Since
  // upsertFixtureFacts writes eventStatus unconditionally, every id whose
  // status has already advanced past "scheduled" must be excluded, or this
  // 10-minute job silently rewinds it to "not_started".
  //
  // This guard used to cover only currently-LIVE ids, which left the far worse
  // case wide open: a fixture correctly recorded as finished/void/dropped got
  // downgraded right back to upcoming, un-settling bets that were about to
  // settle — repeatedly, every cycle, for as long as the window included it.
  const protectedIds = new Set(await getNonDowngradableMatchIds());
  const eligible = deduped.filter((m) => !protectedIds.has(m.matchId));
  const capped = eligible.slice(0, DAILY_CACHE_CAP);

  if (capped.length > 0) {
    await upsertFixtureFacts(capped.map(toFacts), "daily");

    const marketRows = capped
      .filter((m) => m.markets.length > 0)
      .map((m) => ({
        matchId: m.matchId,
        markets: overrideMarkets(m.matchId, buildMarketsForFixture(m.matchId), mapIlotbetMarketsToOverrides(m.markets)),
      }));
    await upsertListMarkets(marketRows, DETAIL_MARKETS_TTL_MS);
  }

  const openBets = await db.bet.findMany({ where: { status: "OPEN" }, select: { legs: true } });
  const keepMatchIds = [
    ...new Set(
      openBets
        .flatMap((b) => b.legs.map((l) => l.fixtureId))
        .filter(isRealFixtureId)
        .map((id) => fromRealFixtureId(id))
        .filter((id): id is string => id !== null)
    ),
  ];
  const pruned = await pruneStaleFixtures(new Date(Date.now() - PRUNE_OLDER_THAN_MS), keepMatchIds);

  return { upserted: capped.length, pruned };
}
