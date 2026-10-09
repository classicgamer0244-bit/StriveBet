import { db } from "@/lib/db";
import { getRealFixtureStates, isRealFixtureId } from "@/lib/ilotbet/fixtures";
import { fromLegacyApiFootballFixtureId, isLegacyApiFootballFixtureId, isAdminFixtureId } from "@/lib/fixture-id";
import { getLegacyApiFootballFixtureStates } from "@/lib/api-football/fixtures";
import type { FixturePhase, FixtureStatus } from "@/types";

const ADMIN_STATUS_MAP: Record<string, FixtureStatus> = {
  UPCOMING: "upcoming",
  LIVE: "live",
  HALFTIME: "halftime",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

/** Everything the My Bets UI needs to show a leg's live state — kickoff
 * countdown, LIVE badge, the "63' H2 | 0:1" line, and cashout eligibility.
 * Modelled on lib/settlement/fixture-lookup.ts (same three-way split) but
 * carries display fields settlement doesn't need. */
export interface BetFixtureState {
  status: FixtureStatus;
  kickoffAt: string;
  score?: { home: number; away: number };
  /** ilotbet/legacy api-football fixtures only — their minute comes
   * pre-formatted from the upstream data, not derived locally. */
  minute?: string;
  /** Admin-simulated fixtures only — the anchor computeMatchPhase() needs to
   * derive the minute locally, ticking every second with no network traffic. */
  phase?: FixturePhase;
}

/** Resolves a mixed batch of admin, ilotbet ("sr:match:…"), and legacy
 * api-football ("af-…", settlement-tail only) fixture ids into the shared
 * state shape the open-bets UI needs. */
export async function lookupBetFixtureStates(fixtureIds: string[]): Promise<Map<string, BetFixtureState>> {
  const map = new Map<string, BetFixtureState>();
  const uniqueIds = [...new Set(fixtureIds)];
  const legacyIds = uniqueIds.filter(isLegacyApiFootballFixtureId);
  const realIds = uniqueIds.filter(isRealFixtureId);
  // isAdminFixtureId, not "everything else" — a malformed id sent to a
  // @db.ObjectId query throws P2023, and this whole function runs inside the
  // my-bets SSE poll where that throw is caught and logged, silently freezing
  // the payload for EVERY connected player. Same guard as its sibling in
  // lib/settlement/fixture-lookup.ts.
  const adminIds = uniqueIds.filter((id) => !isLegacyApiFootballFixtureId(id) && !isRealFixtureId(id) && isAdminFixtureId(id));

  const legacyApiFootballIds = legacyIds.map(fromLegacyApiFootballFixtureId).filter((id): id is number => id !== null);

  const [adminFixtures, realStates, legacyStates] = await Promise.all([
    adminIds.length ? db.adminFixture.findMany({ where: { id: { in: adminIds } } }) : Promise.resolve([]),
    // One Mongo query regardless of how many fixture ids are asked for — this
    // used to be N separate upstream requests, fired on every tick of the
    // my-bets SSE loop for every connected player.
    getRealFixtureStates(realIds),
    getLegacyApiFootballFixtureStates(legacyApiFootballIds),
  ]);

  for (const f of adminFixtures) {
    map.set(f.id, {
      status: ADMIN_STATUS_MAP[f.status],
      kickoffAt: f.kickoffAt.toISOString(),
      score: f.scoreHome !== null && f.scoreAway !== null ? { home: f.scoreHome, away: f.scoreAway } : undefined,
      phase: {
        simKickoffTs: Number(f.simKickoffTs),
        compression: f.compression,
        secondHalfKickoffTs: f.secondHalfKickoffTs !== null ? Number(f.secondHalfKickoffTs) : undefined,
        stoppageMinutes: f.stoppageMinutes ?? undefined,
        firstHalfStoppageMinutes: f.firstHalfStoppageMinutes ?? undefined,
      },
    });
  }
  for (const id of realIds) {
    const info = realStates.get(id);
    if (!info) continue;
    map.set(id, { status: info.status, kickoffAt: info.kickoffAt, score: info.score, minute: info.minute });
  }
  for (const id of legacyIds) {
    const apiFootballId = fromLegacyApiFootballFixtureId(id);
    const info = apiFootballId !== null ? legacyStates.get(apiFootballId) : undefined;
    if (!info) continue;
    map.set(id, { status: info.status, kickoffAt: info.kickoffAt, score: info.score, minute: info.minute });
  }

  return map;
}
