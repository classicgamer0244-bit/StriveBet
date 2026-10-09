import { ilotbetGet } from "../client";
import { isTerminalStatus } from "../status";
import { upsertFixtureFacts, upsertListMarkets, markFixturesDropped } from "../cache/write";
import { getCachedEventStatuses, getCachedLiveMatchIds, getNonDowngradableMatchIds } from "../cache/read";
import { buildIlotbetMarkets } from "../sport-markets";
import { ILOTBET_SPORT_IDS, SERVER_SYNCED_OTHER_SPORTS } from "../sports";
import { DETAIL_MARKETS_TTL_LIVE_MS, DETAIL_MARKETS_TTL_MS } from "../constants";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import { ExpectedRetry } from "@/lib/sync/lock";
import { toFacts, dedupeRawByMatchId } from "./raw-to-facts";
import type { IlotbetDailyMatchesResponse, IlotbetLiveMatchesResponse, IlotbetMatchRaw } from "../types";
import type { SportSlug } from "@/types";

/**
 * Live + daily sync for every sport other than football (see
 * SERVER_SYNCED_OTHER_SPORTS). The same steps as ./live-matches.ts and
 * ./daily-matches.ts, kept in their own lock-guarded jobs so football's
 * settlement-critical sync is never slowed or failed by them.
 *
 * One request per sport, serially, through the shared 1-request/second pacing
 * gate (../client.ts). A sport that fails or loses the pacing race is skipped
 * for this cycle — and crucially its dropped-match diff is skipped with it, so
 * a failed fetch can never be misread as "every live match just ended".
 */

/** Sync's per-sport cap for the date-window listing (football keeps its own). */
const DAILY_CAP_PER_SPORT = 120;
const PAGE_SIZE = 100;
const MAX_PAGES = 2;
const DAYS_AHEAD = 2;

function formatBoundary(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function marketRows(raw: IlotbetMatchRaw[], sport: SportSlug) {
  return raw
    .filter((m) => m.markets.length > 0)
    .map((m) => ({ matchId: m.matchId, markets: buildIlotbetMarkets(m.matchId, sport, m.markets) }));
}

/** Lets ExpectedRetry (pacing/backoff) stop the whole run quietly — every
 * later sport would hit the same wall — while a genuine per-sport error only
 * skips that sport. */
async function forEachSport(fn: (sport: SportSlug) => Promise<void>): Promise<{ ok: SportSlug[]; failed: SportSlug[] }> {
  const ok: SportSlug[] = [];
  const failed: SportSlug[] = [];
  for (const sport of SERVER_SYNCED_OTHER_SPORTS) {
    try {
      await fn(sport);
      ok.push(sport);
    } catch (err) {
      failed.push(sport);
      if (err instanceof ExpectedRetry) break;
      console.error(`ilotbet: ${sport} sync failed:`, err);
    }
  }
  return { ok, failed };
}

export async function syncOtherSportsLive(): Promise<{ upserted: number; terminal: number; failed: SportSlug[] }> {
  let upserted = 0;
  let terminal = 0;

  const { failed } = await forEachSport(async (sport) => {
    const data = await ilotbetGet<IlotbetLiveMatchesResponse>("/api/sbu/un/m/live/matches", { sportId: ILOTBET_SPORT_IDS[sport] });
    const raw = dedupeRawByMatchId(data.data?.matchList ?? []);

    // Same "vanished from the live feed = over, result unknown" handling as
    // football — scoped to this sport's own previously-live matches.
    const rawIds = new Set(raw.map((m) => m.matchId));
    const droppedIds = (await getCachedLiveMatchIds(sport)).filter((id) => !rawIds.has(id));
    if (droppedIds.length > 0) await markFixturesDropped(droppedIds);

    const previousStatus = await getCachedEventStatuses(raw.map((m) => m.matchId));
    if (raw.length > 0) {
      await upsertFixtureFacts(raw.map(toFacts), "live");
      await upsertListMarkets(marketRows(raw, sport), DETAIL_MARKETS_TTL_LIVE_MS);
    }

    const terminalIds = raw
      .filter((m) => {
        const prev = previousStatus.get(m.matchId);
        return !(prev && isTerminalStatus(prev)) && isTerminalStatus(m.eventStatus);
      })
      .map((m) => m.matchId);
    const allTerminal = [...terminalIds, ...droppedIds];
    if (allTerminal.length > 0) await settleBetsForFixtures(allTerminal);

    upserted += raw.length;
    terminal += allTerminal.length;
  });

  return { upserted, terminal, failed };
}

export async function syncOtherSportsDaily(): Promise<{ upserted: number; failed: SportSlug[] }> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + DAYS_AHEAD);
  end.setUTCHours(23, 59, 59, 0);
  const st = formatBoundary(start);
  const et = formatBoundary(end);

  // Read once: the daily listing keeps reporting "not_started" for matches
  // that already kicked off or finished, which must never rewind them (see
  // ./daily-matches.ts for the history behind this guard).
  const protectedIds = new Set(await getNonDowngradableMatchIds());
  let upserted = 0;

  const { failed } = await forEachSport(async (sport) => {
    const all: IlotbetMatchRaw[] = [];
    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      const res = await ilotbetGet<IlotbetDailyMatchesResponse>("/api/sbu/un/m/pre/matches", {
        sportId: ILOTBET_SPORT_IDS[sport],
        st,
        et,
        pageNum,
        pageSize: PAGE_SIZE,
      });
      const matches = res.data?.list?.[0]?.matchList ?? [];
      all.push(...matches);
      if (matches.length < PAGE_SIZE) break;
    }

    const eligible = dedupeRawByMatchId(all)
      .filter((m) => !protectedIds.has(m.matchId))
      .slice(0, DAILY_CAP_PER_SPORT);
    if (eligible.length === 0) return;

    await upsertFixtureFacts(eligible.map(toFacts), "daily");
    await upsertListMarkets(marketRows(eligible, sport), DETAIL_MARKETS_TTL_MS);
    upserted += eligible.length;
  });

  return { upserted, failed };
}
