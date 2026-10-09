import { ensureIlotbetFresh } from "./sync/scheduler";
import { syncMatchDetail } from "./sync/match-detail";
import { ExpectedRetry } from "@/lib/sync/lock";
import {
  getCachedLiveFixtures,
  getCachedUpcomingFixtures,
  getCachedFixturesByTournament,
  getCachedFixtureByMatchId,
  getCachedFixtureStates,
} from "./cache/read";
import { mapEventStatus, formatMinute } from "./status";
import { isRealFixtureId, toRealFixtureId, fromRealFixtureId } from "./fixture-id";
import { DETAIL_MARKETS_TTL_LIVE_MS, DETAIL_MARKETS_TTL_MS } from "./constants";
import { SERVER_SYNCED_OTHER_SPORTS } from "./sports";
import type { Fixture, FixtureStatus, SportSlug } from "@/types";

/**
 * Real (ilotbet) fixture reads — every one of these goes through
 * IlotbetFixtureCache (lib/ilotbet/cache/) and never calls ilotbet directly.
 * ilotbetGet() itself is ONLY ever called from inside a lock-guarded job
 * under lib/ilotbet/sync/ — see that directory's module doc comments — so
 * upstream request RATE is a function of wall-clock time (the sync jobs'
 * TTLs, plus proportionally-rare on-demand detail fetches below), not of how
 * many callers read this file or how often.
 */

const LIVE_FIXTURES_LIMIT = 50;
const UPCOMING_FIXTURES_LIMIT = 60;
/** Per-sport cap for non-football upcoming lists — keeps a busy tennis or
 * American-football day from crowding football out of the combined list. */
const OTHER_SPORT_UPCOMING_LIMIT = 30;

export { isRealFixtureId, toRealFixtureId, fromRealFixtureId };

export async function getRealLiveFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  await ensureIlotbetFresh();
  return getCachedLiveFixtures(LIVE_FIXTURES_LIMIT, sportSlug);
}

export async function getRealUpcomingFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  await ensureIlotbetFresh();
  if (sportSlug) {
    return getCachedUpcomingFixtures(sportSlug === "football" ? UPCOMING_FIXTURES_LIMIT : OTHER_SPORT_UPCOMING_LIMIT, sportSlug);
  }
  // All sports: capped per sport, so football keeps its full list.
  const lists = await Promise.all([
    getCachedUpcomingFixtures(UPCOMING_FIXTURES_LIMIT, "football"),
    ...SERVER_SYNCED_OTHER_SPORTS.map((s) => getCachedUpcomingFixtures(OTHER_SPORT_UPCOMING_LIMIT, s)),
  ]);
  return lists.flat().sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

/** Unlimited, unlike getRealLiveFixtures()/getRealUpcomingFixtures() above —
 * those cap at LIVE_FIXTURES_LIMIT/UPCOMING_FIXTURES_LIMIT for the homepage/
 * live-betting lists, which sort by soonest kickoff platform-wide. A league
 * whose fixtures all start later than the Nth-soonest one elsewhere would
 * fall outside that cap and wrongly appear empty when clicked from the
 * sidebar, even though its own fixture count (an unlimited groupBy) was
 * correct — this is the fix for that mismatch. */
export async function getRealFixturesByTournament(tournamentId: string): Promise<Fixture[]> {
  await ensureIlotbetFresh();
  return getCachedFixturesByTournament(tournamentId);
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

const SIMULATED_LEAGUE_PATTERN = /simulated|\bsrl\b/i;

export async function getRealHighlightFixtures(limit = 30): Promise<Fixture[]> {
  const upcoming = await getRealUpcomingFixtures("football");
  const real = upcoming.filter((f) => !SIMULATED_LEAGUE_PATTERN.test(f.leagueName));
  const sliced = real.slice(0, limit).map((f) => ({ ...f, isHighlight: hashString(f.id) % 10 < 3 }));

  // Enrich the first 4 (the featured card slots) with logos from the detail
  // endpoint — list syncs don't return logos, detail does.
  const toEnrich = sliced.filter((f) => !f.homeTeam.logoUrl || !f.awayTeam.logoUrl).slice(0, 4);
  if (toEnrich.length > 0) {
    const enriched = await Promise.allSettled(
      toEnrich.map((f) => syncMatchDetail(f.id).then(() => getCachedFixtureByMatchId(f.id)))
    );
    const logoMap = new Map<string, Fixture>();
    enriched.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value?.fixture) logoMap.set(toEnrich[i].id, r.value.fixture);
    });
    return sliced.map((f) => logoMap.get(f.id) ?? f);
  }

  return sliced;
}

/** Negative cache for getRealFixtureById()'s one-off detail fetch — a
 * persistently-missing fixture id (bad deep link, or one ilotbet simply
 * doesn't have) can't be hammered with a fetch attempt on every hit. */
const recentMisses = new Map<string, number>();
const MISS_COOLDOWN_MS = 5 * 60_000;

function shouldAttemptFetch(matchId: string): boolean {
  const missedAt = recentMisses.get(matchId);
  return !missedAt || Date.now() - missedAt > MISS_COOLDOWN_MS;
}

/**
 * A fixture's own page always tries for the richer single-match DETAIL
 * response (up to ~80 markets vs the ~25-market list set) — but only
 * actually fetches when the cached copy's detail is missing or past its TTL
 * (20s live / 5min otherwise, see ../constants), so opening the same fixture
 * repeatedly within that window costs zero extra ilotbet requests.
 */
export async function getRealFixtureById(realId: string): Promise<Fixture | undefined> {
  if (!isRealFixtureId(realId)) return undefined;

  await ensureIlotbetFresh();
  const cached = await getCachedFixtureByMatchId(realId);

  if (cached) {
    const ttl = cached.fixture.status === "live" ? DETAIL_MARKETS_TTL_LIVE_MS : DETAIL_MARKETS_TTL_MS;
    const detailAgeMs = cached.detailFetchedAt ? Date.now() - cached.detailFetchedAt.getTime() : Infinity;
    if (cached.marketsSource === "detail" && detailAgeMs < ttl) return cached.fixture;
  }

  if (!shouldAttemptFetch(realId)) return cached?.fixture;

  const { found } = await syncMatchDetail(realId).catch((err) => {
    // ExpectedRetry (lib/sync/lock.ts) means this call merely lost the
    // pacing race against another concurrent ilotbet call and gave up after
    // its retry budget — routine under real traffic, not a sign anything is
    // broken, so it doesn't deserve a red console.error. Falls back to
    // whatever's cached either way; the next open of this fixture tries again.
    if (err instanceof ExpectedRetry) {
      console.warn(`ilotbet: match-detail fetch for ${realId} skipped this attempt (${err.message})`);
    } else {
      console.error(`ilotbet: match-detail fetch failed for ${realId}:`, err);
    }
    return { found: false };
  });

  if (!found) {
    if (!cached) recentMisses.set(realId, Date.now());
    return cached?.fixture;
  }

  const refreshed = await getCachedFixtureByMatchId(realId);
  return refreshed?.fixture ?? cached?.fixture;
}

export interface RealFixtureScoreStatus {
  status: FixtureStatus;
  score?: { home: number; away: number };
  /** Only present if it was captured while the match was still live/in
   * progress — see lib/ilotbet/sync/raw-to-facts.ts's parseHalftimeScore.
   * Needed for the HT/FT settlement market; a bet on a fixture where this
   * is undefined still settles safely (that leg voids instead of guessing —
   * see lib/settlement/resolve-leg.ts). */
  halftimeScore?: { home: number; away: number };
  /** Ice hockey regulation-time score — see lib/ilotbet/sync/raw-to-facts.ts. */
  regulationScore?: { home: number; away: number };
  minute?: string;
  kickoffAt: string;
}

/** Batch form — one Mongo query regardless of how many fixture ids are
 * asked for. Used by the settlement/open-bets live-state lookups (see
 * lib/settlement/fixture-lookup.ts, lib/bets/fixture-state.ts). */
export async function getRealFixtureStates(matchIds: string[]): Promise<Map<string, RealFixtureScoreStatus>> {
  const rows = await getCachedFixtureStates(matchIds);
  const out = new Map<string, RealFixtureScoreStatus>();
  for (const [id, row] of rows) {
    out.set(id, {
      status: mapEventStatus(row.eventStatus),
      score: row.homeScore !== null && row.awayScore !== null ? { home: row.homeScore, away: row.awayScore } : undefined,
      halftimeScore:
        row.halftimeHomeScore !== null && row.halftimeAwayScore !== null
          ? { home: row.halftimeHomeScore, away: row.halftimeAwayScore }
          : undefined,
      regulationScore:
        row.regulationHomeScore !== null && row.regulationAwayScore !== null
          ? { home: row.regulationHomeScore, away: row.regulationAwayScore }
          : undefined,
      minute: formatMinute(row.takeUpTime, row.periodDesc, row.eventStatus, row.fetchedAt),
      kickoffAt: row.scheduledTime.toISOString(),
    });
  }
  return out;
}
