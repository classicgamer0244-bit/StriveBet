import { isRealFixtureId as isEitherRealFixtureId } from "@/lib/fixture-id";

/**
 * ilotbet fixture id helpers — the CURRENT real-fixture id scheme (replaces
 * api-football's numeric-id + "af-" wrapping). ilotbet's own `matchId`
 * (e.g. "sr:match:72180088") is already globally unique, so unlike the
 * api-football scheme there's nothing to wrap/unwrap: it's used verbatim as
 * our fixture id.
 */

const ILOTBET_ID_PREFIX = "sr:match:";

export function isRealFixtureId(id: string): boolean {
  return id.startsWith(ILOTBET_ID_PREFIX);
}

/** Identity — kept as a named function (not a raw string pass-through at
 * call sites) so every place that mints a fixture id from a matchId reads
 * the same way lib/api-football/fixtures.ts's toRealFixtureId() used to. */
export function toRealFixtureId(matchId: string): string {
  return matchId;
}

export function fromRealFixtureId(id: string): string | null {
  return isRealFixtureId(id) ? id : null;
}

/** True for EITHER real-fixture scheme (ilotbet's current one or the
 * api-football legacy tail) — re-exported here for convenience so callers
 * that only care "is this some kind of real fixture" don't need to reach
 * into lib/fixture-id.ts directly. */
export { isEitherRealFixtureId };
