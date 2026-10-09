import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { serializeMarkets, serializeListMarkets } from "./model";
import { FINISHED_STATUSES, VOID_STATUSES, DROPPED_STATUS } from "../status";
import type { Market } from "@/types";

const UPSERT_CONCURRENCY = 25;

async function runChunked<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export interface IlotbetFixtureFactsUpsert {
  matchId: string;
  numericId?: number;
  eventStatus: string;
  periodDesc?: string;
  takeUpTime?: number;
  scheduledTime: Date;
  categoryId?: string;
  categoryName: string;
  tournamentId?: string;
  tournamentName: string;
  tournamentIcon?: string;
  homeName: string;
  homeLogo?: string;
  awayName: string;
  awayLogo?: string;
  homeScore?: number;
  awayScore?: number;
  /** Undefined (never explicitly null) when not parseable this cycle —
   * upsertFixtureFacts's plain `...r` spread relies on that to leave a
   * previously-captured value untouched rather than clobbering it. */
  halftimeHomeScore?: number;
  halftimeAwayScore?: number;
  /** Undefined leaves the stored value untouched, same as the halftime fields. */
  sportId?: string;
  regulationHomeScore?: number;
  regulationAwayScore?: number;
}

/**
 * Upserts fixture FACTS only — never touches markets/listMarkets/
 * marketsSource fields, mirroring lib/api-football/cache/write.ts's split
 * so a routine facts sweep can never clobber a richer market set the
 * on-demand detail fetch (upsertDetailMarkets, below) already wrote.
 */
export async function upsertFixtureFacts(rows: IlotbetFixtureFactsUpsert[], fetchedBy: "daily" | "live" | "detail"): Promise<void> {
  if (rows.length === 0) return;
  const fetchedAt = new Date();
  await runChunked(rows, UPSERT_CONCURRENCY, (r) => {
    const { homeLogo, awayLogo, ...rest } = r;
    const logoUpdate = {
      ...(homeLogo ? { homeLogo } : {}),
      ...(awayLogo ? { awayLogo } : {}),
    };
    return db.ilotbetFixtureCache.upsert({
      where: { matchId: r.matchId },
      create: { ...r, fetchedAt, fetchedBy },
      update: { ...rest, ...logoUpdate, fetchedAt, fetchedBy },
    });
  });
}

export interface IlotbetMarketsUpsert {
  matchId: string;
  markets: Market[];
}

/**
 * Writes the ~25-market LIST set. Uses updateMany with a guard, not a plain
 * upsert: a fixture with no facts row yet has nothing valid to `create`, and
 * a fixture whose markets were more recently refreshed by the on-demand
 * single-match DETAIL endpoint (upsertDetailMarkets) must NOT be downgraded
 * back to the smaller list set on the next routine 25s/10min sync — the
 * whole reason a user's one extra request for the rich set exists.
 */
export async function upsertListMarkets(rows: IlotbetMarketsUpsert[], detailTtlMs: number): Promise<void> {
  if (rows.length === 0) return;
  const staleBefore = new Date(Date.now() - detailTtlMs);
  await runChunked(rows, UPSERT_CONCURRENCY, (r) => {
    const data: Prisma.IlotbetFixtureCacheUpdateManyMutationInput = {
      markets: serializeMarkets(r.markets),
      listMarkets: serializeListMarkets(r.markets),
      marketCount: r.markets.length,
      marketsSource: "list",
    };
    return db.ilotbetFixtureCache.updateMany({
      where: {
        matchId: r.matchId,
        // Mongo distinguishes "field absent" from "explicitly null" — both
        // mean "no detail fetch has ever won here" (same quirk SyncLock and
        // ApiFootballQuota already handle elsewhere in this codebase).
        OR: [
          { marketsSource: null },
          { marketsSource: { isSet: false } },
          { marketsSource: { not: "detail" } },
          { detailFetchedAt: null },
          { detailFetchedAt: { isSet: false } },
          { detailFetchedAt: { lt: staleBefore } },
        ],
      },
      data,
    });
  });
}

/** Writes the on-demand single-match DETAIL market set — always wins,
 * unconditionally: a call to lib/ilotbet/fixtures.ts's getRealFixtureById()
 * is always the freshest, richest data available for that one fixture. */
export async function upsertDetailMarkets(matchId: string, markets: Market[]): Promise<void> {
  const detailFetchedAt = new Date();
  await db.ilotbetFixtureCache.updateMany({
    where: { matchId },
    data: {
      markets: serializeMarkets(markets),
      listMarkets: serializeListMarkets(markets),
      marketCount: markets.length,
      marketsSource: "detail",
      detailFetchedAt,
    },
  });
}

/**
 * Marks fixtures that vanished from ilotbet's /live/matches response with the
 * DROPPED_STATUS sentinel — see syncLiveMatches()'s dropped-fixture diff.
 *
 * It used to write "finished" outright, which was the single biggest source of
 * permanently-stuck bets: vanishing from the live feed tells us the match is
 * over but NOT how it ended, and this leaves the score fields untouched — so a
 * fixture whose score was never captured became "finished with no score", a
 * state settleBetIfReady() refuses forever with no path out. "dropped" says
 * exactly what we actually know ("over, result unknown") and hands the fixture
 * to the authoritative resolver, which asks ilotbet for the real result.
 * Writing nothing at all isn't an option either: the row would still read as
 * live and be re-diffed as dropped on every 25s cycle, forever.
 */
export async function markFixturesDropped(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  await db.ilotbetFixtureCache.updateMany({
    where: { matchId: { in: matchIds } },
    data: { eventStatus: DROPPED_STATUS },
  });
}

/** Deletes cache rows for terminal fixtures whose kickoff was long enough
 * ago that no OPEN bet could plausibly still reference them, EXCEPT ids
 * still referenced by an open bet. Mirrors
 * lib/api-football/cache/write.ts's pruneStaleFixtures() — called from the
 * low-frequency daily-matches sync, the natural low-traffic home for a
 * maintenance pass. */
export async function pruneStaleFixtures(olderThan: Date, keepMatchIds: string[]): Promise<number> {
  const { count } = await db.ilotbetFixtureCache.deleteMany({
    where: {
      scheduledTime: { lt: olderThan },
      eventStatus: { in: [...FINISHED_STATUSES, ...VOID_STATUSES] },
      matchId: { notIn: keepMatchIds },
    },
  });
  return count;
}
