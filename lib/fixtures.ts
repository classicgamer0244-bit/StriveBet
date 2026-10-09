import { db } from "@/lib/db";
import {
  getRealFixtureById,
  getRealFixturesByTournament,
  getRealHighlightFixtures,
  getRealLiveFixtures,
  getRealUpcomingFixtures,
  isRealFixtureId,
} from "@/lib/ilotbet/fixtures";
import { getRealLeagues } from "@/lib/ilotbet/leagues";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { nowMs } from "@/lib/id";
import { isLegacyApiFootballFixtureId } from "@/lib/fixture-id";
import { isSettleableMarket } from "@/lib/settlement/resolve-leg";
import type { AdminFixture as PrismaAdminFixture } from "@prisma/client";
import type { Fixture, FixtureStatus, League, Market, MarketTabKey, SportSlug, Team } from "@/types";

/**
 * The merge layer: real (api-football, never persisted) fixtures + admin
 * (Mongo-persisted) simulated fixtures, in the single shared Fixture shape.
 * Both data/selectors.ts (Server Components) and app/api/fixtures* (client
 * fetch target) call these same functions — one source of truth either way.
 */

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function shortName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "TBA";
}

function toTeam(name: string, logoUrl?: string | null): Team {
  return { id: slugify(name), name, shortName: shortName(name), logoUrl: logoUrl ?? undefined };
}

const ADMIN_STATUS_TO_FIXTURE_STATUS: Record<PrismaAdminFixture["status"], FixtureStatus> = {
  UPCOMING: "upcoming",
  LIVE: "live",
  HALFTIME: "halftime",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

function serializeAdminFixture(f: PrismaAdminFixture): Fixture {
  const status = ADMIN_STATUS_TO_FIXTURE_STATUS[f.status];
  // Frozen at creation, served verbatim forever — an admin fixture's odds
  // are exactly what was saved when it was created, on every surface
  // (list, detail, live), with no scoreline-driven shift. That shift used
  // to be recomputed from nowMs() on every read, which is why a list page
  // loaded once could drift from a detail page re-polling over SSE.
  // Filtered, because "frozen at creation" cuts both ways: a fixture created
  // before a market was withdrawn from sale still has it embedded in Mongo
  // forever. Without this, withdrawn ungradeable markets (corners, cards,
  // first-team-to-score) would keep rendering on older admin fixtures even
  // though bet placement now rejects them — offering a price we won't accept.
  const isInProgress = f.status === "LIVE" || f.status === "HALFTIME";
  const markets: Market[] = f.markets
    .filter((m) => isSettleableMarket(m.name))
    .map((m) => ({
      id: m.id,
      name: m.name,
      tab: m.tab as MarketTabKey,
      info: m.info ?? undefined,
      selections: m.selections.map((s) => ({ id: s.id, label: s.label, odds: s.odds, ...(isInProgress ? { suspended: true } : {}) })),
    }));

  return {
    id: f.id,
    gameId: f.id.slice(-8),
    sportSlug: f.sportSlug as SportSlug,
    leagueId: slugify(f.leagueName),
    leagueName: f.leagueName,
    kickoffAt: f.kickoffAt.toISOString(),
    status,
    homeTeam: toTeam(f.homeTeamName, f.homeTeamLogoUrl),
    awayTeam: toTeam(f.awayTeamName, f.awayTeamLogoUrl),
    score: f.scoreHome !== null && f.scoreAway !== null ? { home: f.scoreHome, away: f.scoreAway } : undefined,
    minute: f.minute ?? undefined,
    markets,
    phase: {
      simKickoffTs: Number(f.simKickoffTs),
      compression: f.compression,
      secondHalfKickoffTs: f.secondHalfKickoffTs !== null ? Number(f.secondHalfKickoffTs) : undefined,
      stoppageMinutes: f.stoppageMinutes ?? undefined,
      firstHalfStoppageMinutes: f.firstHalfStoppageMinutes ?? undefined,
    },
  };
}

/** A database hiccup shouldn't take down real (api-football) listings — fall
 * back to no admin fixtures rather than throwing through the whole page. */
async function findAdminFixtures(where: NonNullable<Parameters<typeof db.adminFixture.findMany>[0]>["where"]) {
  try {
    return await db.adminFixture.findMany({ where });
  } catch (err) {
    console.error("Failed to load admin fixtures:", err);
    return [];
  }
}

/** Keeps live admin fixtures moving even without an external cron — see
 * lib/simulation/tick.ts's throttle. Never lets a tick failure break a read. */
async function tickIfNeeded() {
  try {
    await tickAdminFixturesIfDue(nowMs());
  } catch (err) {
    console.error("Admin fixture tick failed:", err);
  }
}

/** Admin ids (Mongo ObjectId) and real ids ("af-...") live in disjoint
 * namespaces, but de-duplicate anyway — cheap insurance against any upstream
 * source ever returning the same fixture id twice. */
function dedupeById(fixtures: Fixture[]): Fixture[] {
  const seen = new Set<string>();
  const out: Fixture[] = [];
  for (const f of fixtures) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

export async function getLiveFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  await tickIfNeeded();
  const [real, adminRaw] = await Promise.all([
    getRealLiveFixtures(sportSlug),
    findAdminFixtures({ status: { in: ["LIVE", "HALFTIME"] }, ...(sportSlug ? { sportSlug } : {}) }),
  ]);
  return dedupeById([...adminRaw.map(serializeAdminFixture), ...real]);
}

/** Admin-simulated live fixtures only — no real (api-football) fixtures, and
 * no call to getRealLiveFixtures() at all. Used by the SSE realtime routes:
 * real fixtures are deliberately fetch-once/reload-only (not pushed live —
 * they're third-party data, not something we want to poll continuously),
 * while admin fixtures are ours to tick and push as often as we like. */
export async function getLiveAdminFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  await tickIfNeeded();
  const adminRaw = await findAdminFixtures({ status: { in: ["LIVE", "HALFTIME"] }, ...(sportSlug ? { sportSlug } : {}) });
  return dedupeById(adminRaw.map(serializeAdminFixture));
}

export async function getUpcomingFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  await tickIfNeeded();
  const [real, adminRaw] = await Promise.all([
    getRealUpcomingFixtures(sportSlug),
    findAdminFixtures({ status: "UPCOMING", ...(sportSlug ? { sportSlug } : {}) }),
  ]);
  return dedupeById([...adminRaw.map(serializeAdminFixture), ...real]);
}

export async function getHighlightFixtures(): Promise<Fixture[]> {
  return getRealHighlightFixtures();
}

export async function getFixtureById(id: string): Promise<Fixture | undefined> {
  // No longer browsable — api-football is settlement-tail only now (see
  // lib/api-football/fixtures.ts's trimmed scope); a bet's own frozen leg
  // data (fixtureLabel, gameId, kickoffAt, finalScoreHome/Away) is what the
  // ticket-details page actually renders, not a live re-fetch of this.
  if (isLegacyApiFootballFixtureId(id)) return undefined;
  if (isRealFixtureId(id)) return getRealFixtureById(id);
  const f = await db.adminFixture.findUnique({ where: { id } });
  return f ? serializeAdminFixture(f) : undefined;
}

/**
 * Unlimited real-fixture lookup scoped to one league — NOT built from
 * getLiveFixtures()/getUpcomingFixtures() above, which cap at
 * LIVE_FIXTURES_LIMIT/UPCOMING_FIXTURES_LIMIT (lib/ilotbet/fixtures.ts) for
 * the homepage/live-betting lists. Filtering a league out of those capped,
 * globally-soonest-first lists meant a league whose fixtures all start later
 * than the Nth-soonest fixture platform-wide would show a nonzero count in
 * the sidebar (an unlimited groupBy) but render as empty once clicked.
 */
export async function getFixturesByLeague(leagueId: string): Promise<Fixture[]> {
  await tickIfNeeded();
  const [real, adminRaw] = await Promise.all([
    getRealFixturesByTournament(leagueId),
    findAdminFixtures({ status: { in: ["UPCOMING", "LIVE", "HALFTIME"] } }),
  ]);
  const adminMatches = adminRaw.map(serializeAdminFixture).filter((f) => f.leagueId === leagueId);
  return dedupeById([...adminMatches, ...real]);
}

export async function getSidebarLeagues(): Promise<League[]> {
  return getRealLeagues();
}

/** No curated "popular" list — whatever leagues currently have fixtures IS the list. */
export async function getPopularLeagues(): Promise<League[]> {
  return getRealLeagues();
}

export async function getAllLeaguesAZ(): Promise<League[]> {
  const leagues = await getRealLeagues();
  return [...leagues].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLeagueById(id: string): Promise<League | undefined> {
  const leagues = await getRealLeagues();
  return leagues.find((l) => l.id === id);
}
