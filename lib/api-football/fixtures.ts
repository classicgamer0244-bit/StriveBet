import { ensureApiFootballFresh } from "./sync/scheduler";
import { getCachedFixtureStates } from "./cache/read";
import { mapFixtureStatus, formatMinute } from "./status";
import type { FixtureStatus } from "@/types";

/**
 * Settlement-tail only — trimmed as part of the ilotbet cutover. api-football
 * is no longer the listings source (ilotbet fully replaces it — see
 * lib/ilotbet/fixtures.ts, which now owns getRealLiveFixtures/
 * getRealUpcomingFixtures/getRealFixtureById/etc under those same names).
 * This file exists purely so lib/settlement/fixture-lookup.ts and
 * lib/bets/fixture-state.ts can still resolve the handful of bets that
 * still reference "af-…" fixtures until they settle — see
 * app/api/superadmin/api-football/status's `legacyOpenBets`.
 */

export interface LegacyApiFootballFixtureState {
  status: FixtureStatus;
  score?: { home: number; away: number };
  minute?: string;
  kickoffAt: string;
}

/** Batch form — one Mongo query regardless of how many fixture ids are asked
 * for. Named distinctly from lib/ilotbet/fixtures.ts's equivalent so a
 * caller resolving a mixed batch of "af-…" and "sr:match:…" ids during the
 * tail period can never confuse the two sources. */
export async function getLegacyApiFootballFixtureStates(
  apiFootballIds: number[]
): Promise<Map<number, LegacyApiFootballFixtureState>> {
  if (apiFootballIds.length === 0) return new Map();
  await ensureApiFootballFresh();
  const rows = await getCachedFixtureStates(apiFootballIds);
  const out = new Map<number, LegacyApiFootballFixtureState>();
  for (const [id, row] of rows) {
    out.set(id, {
      status: mapFixtureStatus(row.statusShort),
      score: row.goalsHome !== null && row.goalsAway !== null ? { home: row.goalsHome, away: row.goalsAway } : undefined,
      minute: formatMinute(row.elapsed, row.statusShort),
      kickoffAt: row.kickoffAt.toISOString(),
    });
  }
  return out;
}
