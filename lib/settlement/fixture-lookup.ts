import { db } from "@/lib/db";
import { getRealFixtureStates, isRealFixtureId } from "@/lib/ilotbet/fixtures";
import { fromLegacyApiFootballFixtureId, isLegacyApiFootballFixtureId, isAdminFixtureId } from "@/lib/fixture-id";
import { getLegacyApiFootballFixtureStates } from "@/lib/api-football/fixtures";
import { HALFTIME_AT_MINUTE } from "@/lib/simulation/phase";
import type { SettlementFixtureInfo } from "./settle-bet";
import type { AdminFixture } from "@prisma/client";

const ADMIN_STATUS_MAP: Record<string, SettlementFixtureInfo["status"]> = {
  UPCOMING: "upcoming",
  LIVE: "live",
  HALFTIME: "halftime",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

/** Sums applied goal events up to and including minute 45 — admin fixtures
 * are our own deterministic simulation, so unlike real fixtures this is
 * always complete/exact, never a "best effort" derivation. */
function deriveAdminHalftimeScore(fixture: AdminFixture): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const event of fixture.scheduledEvents) {
    if (!event.applied || event.atMinute > HALFTIME_AT_MINUTE) continue;
    if (event.team === "home") home += event.deltaGoals;
    else away += event.deltaGoals;
  }
  return { home, away };
}

/** Resolves a mixed batch of admin, ilotbet ("sr:match:…"), and legacy
 * api-football ("af-…", settlement-tail only — see
 * lib/api-football/fixtures.ts) fixture ids into the shared {status, score}
 * shape settlement needs — never fetches odds/markets, since settlement
 * doesn't use them. */
export async function lookupFixtureInfo(fixtureIds: string[]): Promise<Map<string, SettlementFixtureInfo>> {
  const map = new Map<string, SettlementFixtureInfo>();
  const uniqueIds = [...new Set(fixtureIds)];
  const legacyIds = uniqueIds.filter(isLegacyApiFootballFixtureId);
  const realIds = uniqueIds.filter(isRealFixtureId);
  // isAdminFixtureId (not just "everything else") — an id matching no scheme is
  // dropped rather than sent to a @db.ObjectId query, where a malformed value
  // throws P2023 and takes the entire batch down with it. See its doc comment:
  // this runs over every OPEN bet's legs at once, so one bad id used to mean
  // nothing on the platform settled.
  const adminIds = uniqueIds.filter((id) => !isLegacyApiFootballFixtureId(id) && !isRealFixtureId(id) && isAdminFixtureId(id));

  const legacyApiFootballIds = legacyIds.map(fromLegacyApiFootballFixtureId).filter((id): id is number => id !== null);

  const [adminFixtures, realStates, legacyStates] = await Promise.all([
    adminIds.length ? db.adminFixture.findMany({ where: { id: { in: adminIds } } }) : Promise.resolve([]),
    getRealFixtureStates(realIds),
    getLegacyApiFootballFixtureStates(legacyApiFootballIds),
  ]);

  for (const f of adminFixtures) {
    map.set(f.id, {
      status: ADMIN_STATUS_MAP[f.status],
      score: f.scoreHome !== null && f.scoreAway !== null ? { home: f.scoreHome, away: f.scoreAway } : undefined,
      halftimeScore: deriveAdminHalftimeScore(f),
    });
  }
  for (const id of realIds) {
    const info = realStates.get(id);
    if (info) map.set(id, info);
  }
  for (const id of legacyIds) {
    const apiFootballId = fromLegacyApiFootballFixtureId(id);
    const info = apiFootballId !== null ? legacyStates.get(apiFootballId) : undefined;
    if (info) map.set(id, info);
  }

  return map;
}
