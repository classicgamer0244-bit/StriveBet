import { db } from "@/lib/db";
import { isRealFixtureId as isIlotbetFixtureId } from "@/lib/ilotbet/fixtures";
import { isAdminFixtureId, isLegacyApiFootballFixtureId } from "@/lib/fixture-id";
import { syncMatchDetail } from "@/lib/ilotbet/sync/match-detail";
import { getIlotbetBackoffUntil } from "@/lib/ilotbet/client";
import { COMPLETE_AFTER_MS, sportSlugFromIlotbetId } from "@/lib/ilotbet/sports";
import { ExpectedRetry } from "@/lib/sync/lock";
import { computeMatchPhase, halftimeBreakMs, DEFAULT_STOPPAGE } from "@/lib/simulation/phase";
import { lookupFixtureInfo } from "./fixture-lookup";
import { settleBetsForFixtures } from "./settle-bets-for-fixtures";
import type { AdminFixture } from "@prisma/client";

/**
 * # Authoritative fixture resolution
 *
 * The fix for the single largest class of stuck bets: a bet whose matches have
 * all obviously ended, sitting OPEN forever.
 *
 * The old model INFERRED that a real match had finished from it disappearing
 * out of ilotbet's `/live/matches` feed. That inference only ever ran for
 * fixtures we had already seen listed as live — so a match the 25-second poll
 * never happened to catch mid-play stayed `not_started` in our cache
 * permanently, hours or days after full time, and `settleBetIfReady()` quite
 * correctly refused to settle it. Nothing in the system could ever move it
 * forward: the orphan sweep re-asks the same question and gets the same answer,
 * and there was no kickoff-based timeout anywhere. Measured on production
 * before this existed: 65 of the 70 fixtures blocking open bets were in exactly
 * that state.
 *
 * This module replaces inference with authority. Open bets are the demand
 * signal — for each fixture with real money still riding on it past its
 * expected end, we go and establish the actual result:
 *
 *   - **ilotbet** — ask the single-match endpoint directly (`syncMatchDetail`),
 *     which returns real status and scores rather than requiring the match to
 *     be present in a list we happened to poll at the right moment.
 *   - **admin-simulated** — nothing to ask; we own these outright. Recompute
 *     the phase and force-complete from our own data. This is the second chance
 *     the sim tick structurally cannot provide, since it only ever loads
 *     UPCOMING/LIVE/HALFTIME fixtures and never revisits one it has already
 *     marked FINISHED.
 *   - **legacy api-football** — left to the existing `syncBetFixtures` tail.
 *
 * Same demand-driven shape as `lib/api-football/sync/bet-fixtures.ts`, which
 * already sweeps by bet-referenced ids for the legacy source.
 */

/** How long after kickoff a real match is presumed to be over — per sport
 * (lib/ilotbet/sports.ts): 110 minutes for football (90 plus halftime,
 * stoppage, and a late-kickoff margin), hours for tennis or baseball. Below
 * this we simply let the live feed do its job; asking earlier finds the match
 * still in play and burns one of its limited resolve attempts. */
const DEFAULT_COMPLETE_AFTER_MS = COMPLETE_AFTER_MS.football;

/** Bounds one run against ilotbet's global 1-request/second pacing gate. This
 * job shares that gate with the live feed and with on-demand fixture opens, so
 * it must never monopolise it. */
const RESOLVE_BUDGET_MS = 20_000;
const MAX_RESOLVE_PER_RUN = 15;

/** Give up re-asking after this many failed attempts. ilotbet answers "not
 * found" forever for a match id it has purged, so without a cap those dead
 * fixtures would consume the entire per-run budget on every single run and
 * starve the fixtures that can still be resolved. */
const MAX_RESOLVE_ATTEMPTS = 6;

export interface ResolveFixturesResult {
  candidates: number;
  adminCompleted: number;
  ilotbetResolved: number;
  ilotbetNotFound: number;
  ilotbetErrors: number;
  budgetExhausted: boolean;
  settled: number;
  /** Distinct raw eventStatus values seen this run — ground truth for
   * lib/ilotbet/status.ts, whose terminal vocabulary is otherwise guesswork. */
  observedStatuses: string[];
  /** Set when the ilotbet branch was skipped wholesale because the client is in
   * its error backoff window. Surfacing this is important: it is the difference
   * between "nothing needed resolving" and "we could not even ask". */
  upstreamBackoffUntil?: string;
}

interface Candidate {
  fixtureId: string;
  stakeAtRiskMinor: number;
  kickoffAt: Date | null;
}

/** True once we have everything settlement needs — a final score, or an
 * explicit cancellation. Anything else still needs resolving. */
function isResolved(info: { status: string; score?: unknown } | undefined): boolean {
  if (!info) return false;
  if (info.status === "cancelled") return true;
  return info.status === "finished" && info.score !== undefined;
}

/**
 * Latest wall-clock instant an admin fixture could still be in play.
 *
 * Deliberately not just `computeMatchPhase(...).isFinished`: that function pins
 * at halftime forever when `secondHalfKickoffTs` was never written, which is
 * precisely what happens when the tick stopped running mid-match (an overnight
 * window with no traffic — the exact scenario behind "evening games never
 * settled"). This bounds the whole match from its kickoff instead, so a fixture
 * frozen at HT is still recognised as long over.
 */
function adminMatchLatestEndMs(fixture: AdminFixture): number {
  const fullTimeMinutes = 90 + (fixture.stoppageMinutes ?? DEFAULT_STOPPAGE);
  const playMs = (fullTimeMinutes / fixture.compression) * 1000;
  return Number(fixture.simKickoffTs) + playMs + halftimeBreakMs(fixture.compression);
}

export async function resolveOverdueFixtures(
  options: { deadlineMs?: number } = {}
): Promise<ResolveFixturesResult> {
  const result: ResolveFixturesResult = {
    candidates: 0,
    adminCompleted: 0,
    ilotbetResolved: 0,
    ilotbetNotFound: 0,
    ilotbetErrors: 0,
    budgetExhausted: false,
    settled: 0,
    observedStatuses: [],
  };

  const openBets = await db.bet.findMany({
    where: { status: "OPEN" },
    select: { stakeMinor: true, placedAt: true, legs: { select: { fixtureId: true, kickoffAt: true } } },
  });
  if (openBets.length === 0) return result;

  // Aggregate demand per fixture: how much money is riding on it, and the
  // earliest kickoff any bet recorded for it. `placedAt` is the last-resort
  // kickoff source — always present, and conservatively late, which is the safe
  // direction (we'd rather resolve a fixture slightly later than too early).
  const demand = new Map<string, Candidate>();
  for (const bet of openBets) {
    for (const leg of bet.legs) {
      const existing = demand.get(leg.fixtureId);
      const kickoff = leg.kickoffAt ?? bet.placedAt;
      if (existing) {
        existing.stakeAtRiskMinor += Number(bet.stakeMinor);
        if (kickoff && (!existing.kickoffAt || kickoff < existing.kickoffAt)) existing.kickoffAt = kickoff;
      } else {
        demand.set(leg.fixtureId, {
          fixtureId: leg.fixtureId,
          stakeAtRiskMinor: Number(bet.stakeMinor),
          kickoffAt: kickoff,
        });
      }
    }
  }

  const known = await lookupFixtureInfo([...demand.keys()]);
  const unresolved = [...demand.values()].filter((c) => !isResolved(known.get(c.fixtureId)));
  result.candidates = unresolved.length;
  if (unresolved.length === 0) return result;

  const now = Date.now();
  const touchedFixtureIds: string[] = [];

  // --- Admin fixtures: force-complete from our own data ---------------------
  const adminIds = unresolved.filter((c) => isAdminFixtureId(c.fixtureId)).map((c) => c.fixtureId);
  if (adminIds.length > 0) {
    const fixtures = await db.adminFixture.findMany({
      where: { id: { in: adminIds }, status: { in: ["UPCOMING", "LIVE", "HALFTIME"] } },
    });
    for (const fixture of fixtures) {
      const phase = computeMatchPhase(
        {
          simKickoffTs: Number(fixture.simKickoffTs),
          compression: fixture.compression,
          secondHalfKickoffTs: fixture.secondHalfKickoffTs !== null ? Number(fixture.secondHalfKickoffTs) : undefined,
          stoppageMinutes: fixture.stoppageMinutes ?? undefined,
          firstHalfStoppageMinutes: fixture.firstHalfStoppageMinutes ?? undefined,
        },
        now
      );
      if (!phase.isFinished && now < adminMatchLatestEndMs(fixture)) continue;

      // Same shape the manual force-settle route writes. Scores default to 0
      // rather than staying null: a null score is unsettleable, and 0-0 is the
      // truthful result for a simulated match with no goal events applied.
      await db.adminFixture.update({
        where: { id: fixture.id },
        data: {
          status: "FINISHED",
          minute: "FT",
          scoreHome: fixture.scoreHome ?? 0,
          scoreAway: fixture.scoreAway ?? 0,
        },
      });
      touchedFixtureIds.push(fixture.id);
      result.adminCompleted += 1;
      await recordAttempt(fixture.id, "resolved", null);
    }
  }

  // --- ilotbet fixtures: ask upstream, budgeted and serial ------------------
  // Serial on purpose. lib/ilotbet/client.ts paces every request through one
  // global 1/sec slot with a short retry budget, so concurrent calls here would
  // simply lose that race against each other and throw ExpectedRetry.
  const ilotbetCandidates = unresolved.filter(
    (c) => isIlotbetFixtureId(c.fixtureId) && !isLegacyApiFootballFixtureId(c.fixtureId)
  );
  const sportRows = ilotbetCandidates.length
    ? await db.ilotbetFixtureCache.findMany({
        where: { matchId: { in: ilotbetCandidates.map((c) => c.fixtureId) } },
        select: { matchId: true, sportId: true },
      })
    : [];
  const completeAfterById = new Map(
    sportRows.map((r) => [r.matchId, COMPLETE_AFTER_MS[sportSlugFromIlotbetId(r.sportId)] ?? DEFAULT_COMPLETE_AFTER_MS])
  );
  const dueForResolve = ilotbetCandidates.filter(
    (c) =>
      !c.kickoffAt ||
      now - c.kickoffAt.getTime() >= (completeAfterById.get(c.fixtureId) ?? DEFAULT_COMPLETE_AFTER_MS)
  );

  // Checked ONCE, up front. While ilotbet is backed off every request throws
  // immediately, so without this the loop below would spin through its entire
  // queue doing nothing, exhaust the wall-clock budget, and report zeroes that
  // look identical to "no work found" — which is exactly how it behaved the
  // first time this ran against production.
  const backoffUntil = dueForResolve.length > 0 ? await getIlotbetBackoffUntil() : null;
  if (backoffUntil) {
    result.upstreamBackoffUntil = backoffUntil.toISOString();
    console.warn(
      `resolve-fixtures: skipping ${dueForResolve.length} ilotbet fixture(s) — upstream backed off until ${backoffUntil.toISOString()}`
    );
    // Recorded so the skip is VISIBLE per fixture rather than inferable only
    // from this log line. A sustained outage previously left 108 of 116 stuck
    // fixtures with no FixtureSettlementState row at all, which made the
    // resolver look idle rather than blocked.
    //
    // countAttempt is false on purpose. resolveAttempts means "we asked and got
    // no usable answer"; during backoff we never asked. Counting it would climb
    // to MAX_RESOLVE_ATTEMPTS within minutes of any outage and permanently
    // abandon fixtures that were only ever unreachable — and it would
    // simultaneously satisfy overdue.ts's MIN_ATTEMPTS_BEFORE_VOID and start
    // refunding bets we could still have graded. See the note there.
    await Promise.all(
      dueForResolve.map((c) => recordAttempt(c.fixtureId, "skipped_backoff", null, c.kickoffAt, false))
    );
  }

  if (dueForResolve.length > 0 && !backoffUntil) {
    const states = await db.fixtureSettlementState.findMany({
      where: { fixtureId: { in: dueForResolve.map((c) => c.fixtureId) } },
      select: { fixtureId: true, resolveAttempts: true },
    });
    const attemptsById = new Map(states.map((s) => [s.fixtureId, s.resolveAttempts]));

    // Most money first, oldest kickoff as tiebreak — if the budget runs out,
    // it should run out on the least consequential fixtures.
    const queue = dueForResolve
      .filter((c) => (attemptsById.get(c.fixtureId) ?? 0) < MAX_RESOLVE_ATTEMPTS)
      .sort((a, b) => {
        if (b.stakeAtRiskMinor !== a.stakeAtRiskMinor) return b.stakeAtRiskMinor - a.stakeAtRiskMinor;
        return (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0);
      })
      .slice(0, MAX_RESOLVE_PER_RUN);

    const deadline = Math.min(Date.now() + RESOLVE_BUDGET_MS, options.deadlineMs ?? Number.POSITIVE_INFINITY);
    const observed = new Set<string>();

    for (const candidate of queue) {
      if (Date.now() >= deadline) {
        result.budgetExhausted = true;
        break;
      }
      try {
        const { found } = await syncMatchDetail(candidate.fixtureId);
        if (found) {
          result.ilotbetResolved += 1;
          touchedFixtureIds.push(candidate.fixtureId);
          // `found` means only that ilotbet returned this match — NOT that we
          // can now grade it. A match still in play answers `found` too, so
          // counting every one as an attempt burned the give-up budget on
          // fixtures that were merely running long: six successful fetches
          // (~12 minutes) removed one from this queue permanently, while
          // `lastOutcome` read "resolved" throughout and made the diagnostics
          // actively misleading. Re-asked through lookupFixtureInfo so the test
          // is byte-identical to the one settlement itself applies.
          const gradeable = isResolved((await lookupFixtureInfo([candidate.fixtureId])).get(candidate.fixtureId));
          await recordAttempt(
            candidate.fixtureId,
            gradeable ? "resolved" : "not_gradeable",
            null,
            candidate.kickoffAt,
            !gradeable,
            gradeable
          );
        } else {
          result.ilotbetNotFound += 1;
          await recordAttempt(candidate.fixtureId, "not_found", null, candidate.kickoffAt);
        }
      } catch (err) {
        // Losing the pacing slot is routine, not a fault — don't burn an
        // attempt on it, or a busy period would exhaust MAX_RESOLVE_ATTEMPTS
        // without ever having actually asked ilotbet anything. `break`, not
        // `continue`: contention or a backoff entered mid-run affects the whole
        // client, so the rest of this queue would fail identically. Stop and
        // let the next scheduled run try again.
        if (err instanceof ExpectedRetry) {
          await recordAttempt(candidate.fixtureId, "skipped_paced", null, candidate.kickoffAt, false);
          break;
        }
        result.ilotbetErrors += 1;
        const message = err instanceof Error ? err.message : String(err);
        await recordAttempt(candidate.fixtureId, "error", message.slice(0, 300), candidate.kickoffAt);
      }
    }

    // Ground truth for the guessed status vocabulary in lib/ilotbet/status.ts.
    if (touchedFixtureIds.length > 0) {
      const rows = await db.ilotbetFixtureCache.findMany({
        where: { matchId: { in: touchedFixtureIds } },
        select: { eventStatus: true },
      });
      for (const row of rows) observed.add(row.eventStatus);
    }
    result.observedStatuses = [...observed];
  }

  if (touchedFixtureIds.length > 0) {
    const settleResult = await settleBetsForFixtures(touchedFixtureIds, { deadlineMs: options.deadlineMs });
    result.settled = settleResult.settled;
  }

  return result;
}

/** Upserts this fixture's resolver bookkeeping. `countAttempt: false` records
 * the outcome without advancing the give-up counter; `resetAttempts` clears it
 * outright, for a fixture that has genuinely resolved and must not carry a
 * stale give-up budget if it is ever revisited. */
async function recordAttempt(
  fixtureId: string,
  outcome: string,
  lastError: string | null,
  kickoffAt?: Date | null,
  countAttempt = true,
  resetAttempts = false
): Promise<void> {
  try {
    await db.fixtureSettlementState.upsert({
      where: { fixtureId },
      create: {
        fixtureId,
        kickoffAt: kickoffAt ?? undefined,
        resolveAttempts: countAttempt ? 1 : 0,
        lastAttemptAt: new Date(),
        lastOutcome: outcome,
        lastError,
      },
      update: {
        ...(resetAttempts ? { resolveAttempts: 0 } : countAttempt ? { resolveAttempts: { increment: 1 } } : {}),
        ...(kickoffAt ? { kickoffAt } : {}),
        lastAttemptAt: new Date(),
        lastOutcome: outcome,
        lastError,
      },
    });
  } catch (err) {
    // Bookkeeping must never take down a resolution that actually worked.
    console.error(`resolve-fixtures: failed to record attempt for ${fixtureId}:`, err);
  }
}
