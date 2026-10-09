/**
 * Real (non-admin) vs admin-simulated fixture id helpers — deliberately
 * split into their own tiny isomorphic module so client code (hooks/
 * use-fixtures.ts) can tell the two apart without importing the heavier,
 * server-only lib/ilotbet/fixtures.ts into the browser bundle. This is also
 * what lets the client decide "admin fixtures get live push updates, real
 * fixtures only ever refresh on page load/reload" without a round trip.
 *
 * Two "real" id schemes coexist during the api-football → ilotbet cutover:
 * ilotbet's "sr:match:…" (the current, active source — see
 * lib/ilotbet/fixture-id.ts) and the legacy "af-…" scheme, kept recognizable
 * here ONLY because a handful of bets placed before the cutover still
 * reference api-football fixtures and need to keep resolving until they
 * settle (see app/api/superadmin/api-football/status's `legacyOpenBets`).
 * Once that count reads 0, the legacy prefix/helpers below can come out.
 */

const ILOTBET_ID_PREFIX = "sr:match:";
const LEGACY_API_FOOTBALL_ID_PREFIX = "af-";

/** True for either real-fixture id scheme — the only thing client code
 * (hooks/use-fixtures.ts, the realtime fixture routes) actually needs to
 * know: "not an admin fixture, don't subscribe to live push for this one." */
export function isRealFixtureId(id: string): boolean {
  return id.startsWith(ILOTBET_ID_PREFIX) || id.startsWith(LEGACY_API_FOOTBALL_ID_PREFIX);
}

/**
 * An admin fixture id is a raw Mongo ObjectId (24 hex chars) — admin ids carry
 * no prefix, so every lookup that partitions ids by scheme ends up treating
 * "neither sr:match: nor af-" as "must be an admin fixture" and feeding it
 * straight to a `@db.ObjectId` query.
 *
 * That makes a single malformed leg id a poison pill: Prisma throws P2023 for a
 * non-24-hex value, and because these lookups batch every id in one `in` query,
 * one bad id takes down the WHOLE batch — which for settlement means the
 * platform-wide backstop sweep throws on every cycle and no bet settles at all,
 * and for lib/bets/fixture-state.ts means the my-bets SSE payload silently
 * stops updating for every user. Callers filter with this first so a bad id
 * costs exactly one unresolvable fixture instead of everyone's settlement.
 */
export function isAdminFixtureId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// --- Legacy api-football scheme — settlement-tail use only ------------------

export function isLegacyApiFootballFixtureId(id: string): boolean {
  return id.startsWith(LEGACY_API_FOOTBALL_ID_PREFIX);
}

export function toLegacyApiFootballFixtureId(apiFootballId: number): string {
  return `${LEGACY_API_FOOTBALL_ID_PREFIX}${apiFootballId}`;
}

export function fromLegacyApiFootballFixtureId(id: string): number | null {
  if (!isLegacyApiFootballFixtureId(id)) return null;
  const n = Number(id.slice(LEGACY_API_FOOTBALL_ID_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}
