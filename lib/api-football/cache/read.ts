import { db } from "@/lib/db";

/**
 * Settlement-tail only — trimmed as part of the ilotbet cutover. Everything
 * odds/listing-related (getCachedLiveFixtures, getCachedUpcomingFixtures,
 * getCachedLeagueCounts, the prematch-odds drip, toFixture()/markets
 * handling in ./model) is gone: this file only needs to answer "what's this
 * fixture's status/score right now?" for the handful of "af-…" legs still
 * waiting to settle.
 */

export interface CachedFixtureState {
  apiFixtureId: number;
  statusShort: string;
  elapsed: number | null;
  kickoffAt: Date;
  goalsHome: number | null;
  goalsAway: number | null;
}

/** Batch form — one Mongo query regardless of how many fixture ids are asked
 * for, replacing what used to be N upstream requests. */
export async function getCachedFixtureStates(apiFixtureIds: number[]): Promise<Map<number, CachedFixtureState>> {
  if (apiFixtureIds.length === 0) return new Map();
  const rows = await db.apiFixtureCache.findMany({
    where: { apiFixtureId: { in: apiFixtureIds } },
    select: { apiFixtureId: true, statusShort: true, elapsed: true, kickoffAt: true, goalsHome: true, goalsAway: true },
  });
  return new Map(rows.map((r) => [r.apiFixtureId, r]));
}

/** apiFixtureId -> statusShort only, for the terminal-transition diff the
 * live/bet-fixtures syncs use to decide which fixtures just finished. */
export async function getCachedStatusShorts(apiFixtureIds: number[]): Promise<Map<number, string>> {
  if (apiFixtureIds.length === 0) return new Map();
  const rows = await db.apiFixtureCache.findMany({
    where: { apiFixtureId: { in: apiFixtureIds } },
    select: { apiFixtureId: true, statusShort: true },
  });
  return new Map(rows.map((r) => [r.apiFixtureId, r.statusShort]));
}
