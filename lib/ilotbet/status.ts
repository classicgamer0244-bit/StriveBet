import type { FixtureStatus } from "@/types";

/**
 * ilotbet's `eventStatus` taxonomy. Only "not_started" and "live" were
 * actually observed during planning — everything else below is an informed
 * guess, not a confirmed fact: `matchId`'s "sr:match:" prefix strongly
 * suggests this API is built on Sportradar's match data model, so the
 * terminal/void values here follow Sportradar's typical status vocabulary
 * ("closed"/"ended" for finished, "postponed"/"cancelled"/"interrupted"/
 * "abandoned"/"delayed" for void-ish states). Unknown values fall back to
 * "upcoming" with a console.warn — same conservative-default pattern
 * lib/api-football/status.ts used — so a wrong guess here degrades to "this
 * fixture doesn't show as live/finished yet" rather than mis-settling a bet.
 * Watch a real match through full time/postponement and correct this file
 * once the real values are known (see the plan's verification checklist).
 */
export const SCHEDULED_STATUSES = new Set(["not_started"]);
export const IN_PLAY_STATUSES = new Set(["live"]);
export const FINISHED_STATUSES = new Set(["closed", "ended", "finished", "ft"]);
/**
 * Genuinely terminal void states only.
 *
 * "interrupted" and "delayed" were REMOVED: in Sportradar's vocabulary both are
 * transient in-play conditions (a stoppage, a weather delay), not final ones. A
 * match briefly reported as either would have had every leg on it voided and
 * refunded permanently — and irreversibly, since mapEventStatus sends them to
 * "cancelled", which settle-bet.ts checks BEFORE the score check, so even a
 * perfectly good final score arriving later could not save the bet. A match in
 * one of those states is now simply not terminal; if it never resolves, the
 * overdue sweep (lib/settlement/overdue.ts) handles it deliberately instead.
 */
export const VOID_STATUSES = new Set(["postponed", "cancelled", "canceled", "abandoned", "removed"]);

/**
 * Our own sentinel, never sent by ilotbet: a fixture that was live and then
 * silently vanished from the live feed. It is NOT terminal — we know the match
 * is over but not how it ended, and settling on a half-known score would be
 * worse than waiting. The authoritative resolver
 * (lib/settlement/resolve-fixtures.ts) picks these up and asks ilotbet directly
 * for the real result.
 *
 * Kept out of isTerminalStatus() on purpose so pruneStaleFixtures() won't
 * delete the row before the resolver gets to it.
 */
export const DROPPED_STATUS = "dropped";

export function mapEventStatus(eventStatus: string): FixtureStatus {
  const s = eventStatus.toLowerCase();
  if (IN_PLAY_STATUSES.has(s)) return "live";
  if (FINISHED_STATUSES.has(s)) return "finished";
  if (VOID_STATUSES.has(s)) return "cancelled";
  if (SCHEDULED_STATUSES.has(s)) return "upcoming";
  // Known-unknown: we deliberately can't say how it ended yet. No warning —
  // this is an expected state, not a surprise from upstream.
  if (s === DROPPED_STATUS) return "upcoming";
  console.warn(`ilotbet: unrecognized eventStatus "${eventStatus}", treating as upcoming.`);
  return "upcoming";
}

export function isInPlayStatus(eventStatus: string): boolean {
  return IN_PLAY_STATUSES.has(eventStatus.toLowerCase());
}

export function isVoidStatus(eventStatus: string): boolean {
  return VOID_STATUSES.has(eventStatus.toLowerCase());
}

/** Finished ∪ void — a fixture that will never move again. Settlement and
 * the sync jobs' status-transition diff both key off this. */
export function isTerminalStatus(eventStatus: string): boolean {
  const s = eventStatus.toLowerCase();
  return FINISHED_STATUSES.has(s) || VOID_STATUSES.has(s);
}

/** Non-football in-play label: the period itself ("2nd quarter", "1st set",
 * "3rd period") — these sports report no running minute (takeUpTime is 0). */
export function formatPeriodLabel(periodDesc: string | null | undefined, eventStatus: string): string | undefined {
  if (isTerminalStatus(eventStatus)) return "FT";
  if (SCHEDULED_STATUSES.has(eventStatus.toLowerCase())) return undefined;
  return periodDesc || "Live";
}

/**
 * Match-minute display. `takeUpTime` (seconds) is inferred — not confirmed —
 * to be a running total since kickoff rather than resetting each half: a
 * real "2nd half" observation had takeUpTime=3575 (~59.6 min), which only
 * makes sense as total-elapsed (59' into the match); read as
 * seconds-into-this-half it would imply the match is already past 100
 * minutes, which doesn't happen in regulation. Revisit once a match is
 * watched through a real halftime (see the plan's verification checklist).
 */
export function formatMinute(
  takeUpTime: number | null | undefined,
  periodDesc: string | null | undefined,
  eventStatus: string,
  /** When takeUpTime was last written to the cache — used to extrapolate
   * forward so the displayed minute doesn't lag behind by the sync interval. */
  fetchedAt?: Date | null
): string | undefined {
  if (isTerminalStatus(eventStatus)) return "FT";
  if (SCHEDULED_STATUSES.has(eventStatus.toLowerCase())) return undefined;
  if (periodDesc && /half.?time/i.test(periodDesc)) return "HT";
  if (takeUpTime === null || takeUpTime === undefined) return periodDesc ?? undefined;
  const staleSecs = fetchedAt ? Math.max(0, (Date.now() - fetchedAt.getTime()) / 1000) : 0;
  const minute = Math.floor((takeUpTime + staleSecs) / 60);
  const halfLabel = periodDesc
    ? /2nd|second/i.test(periodDesc) ? " H2" : /1st|first/i.test(periodDesc) ? " H1" : ""
    : "";
  return `${minute}'${halfLabel}`;
}
