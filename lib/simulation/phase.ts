/**
 * Pure match-phase math — no server-only imports, so this is safely
 * importable from both the server (tick.ts, serializers) and the client
 * (hooks/use-fixtures.ts, to recompute the displayed minute every second
 * with zero network traffic). Given the same anchor timestamps, this always
 * produces the same result regardless of when it's called — that's what
 * lets a page refresh mid-match show the correct minute instead of
 * resetting, and what lets the client tick the clock without polling.
 */

export const HALFTIME_AT_MINUTE = 45;
export const HALFTIME_BREAK_MATCH_MINUTES = 15;
export const MIN_STOPPAGE = 3;
export const MAX_STOPPAGE = 6;
export const DEFAULT_STOPPAGE = 4;
export const DEFAULT_FIRST_HALF_STOPPAGE = 3;

/** A real 15-match-minute break — at today's real-time (1:1) compression
 * that's a literal 15 real-world minutes; the formula stays correct even if
 * compression ever changes. */
export function halftimeBreakMs(compression: number): number {
  return (HALFTIME_BREAK_MATCH_MINUTES / compression) * 1000;
}

export function rollStoppageMinutes(): number {
  return Math.floor(Math.random() * (MAX_STOPPAGE - MIN_STOPPAGE + 1)) + MIN_STOPPAGE;
}

export interface PhaseAnchor {
  simKickoffTs: number;
  compression: number;
  secondHalfKickoffTs?: number;
  stoppageMinutes?: number;
  firstHalfStoppageMinutes?: number;
}

export interface PhaseResult {
  /** Match-minute for settlement/display math — clamped, monotonic within a half. */
  minute: number;
  /** Display label, e.g. "23'", "HT", "FT", "90+4'", "45+2'". */
  label: string;
  isHalftime: boolean;
  isFinished: boolean;
  /** Which half is playing — 1 through kickoff/first-half/HT, 2 once the
   * second-half anchor has passed. Not meaningful once isFinished. */
  half: 1 | 2;
}

/** Given known anchors + "now", what phase is this match in? Pure function —
 * call it fresh any time rather than trusting a possibly-stale stored label. */
export function computeMatchPhase(anchor: PhaseAnchor, nowMs: number): PhaseResult {
  const fullTime = 90 + (anchor.stoppageMinutes ?? DEFAULT_STOPPAGE);
  const halftimeAt = HALFTIME_AT_MINUTE + (anchor.firstHalfStoppageMinutes ?? DEFAULT_FIRST_HALF_STOPPAGE);

  if (!anchor.secondHalfKickoffTs) {
    // Still in (or just reaching the end of) the first half.
    const raw = Math.max(1, Math.floor(((nowMs - anchor.simKickoffTs) / 1000) * anchor.compression));
    if (raw < HALFTIME_AT_MINUTE) {
      return { minute: raw, label: `${raw}'`, isHalftime: false, isFinished: false, half: 1 };
    }
    if (raw < halftimeAt) {
      // Match-minute is clamped at 45 through first-half stoppage — only the
      // label advances — so downstream consumers (scheduled goals, live odds
      // shift) stay monotonic across the break exactly like the 90+N phase.
      return { minute: HALFTIME_AT_MINUTE, label: `45+${raw - HALFTIME_AT_MINUTE}'`, isHalftime: false, isFinished: false, half: 1 };
    }
    // Reached 45'+stoppage but the second-half anchor hasn't been rolled yet
    // (tick.ts hasn't run since) — pin at HT; tick.ts is what actually flips
    // the fixture to HALFTIME status and sets secondHalfKickoffTs.
    return { minute: HALFTIME_AT_MINUTE, label: "HT", isHalftime: true, isFinished: false, half: 1 };
  }

  if (nowMs < anchor.secondHalfKickoffTs) {
    return { minute: HALFTIME_AT_MINUTE, label: "HT", isHalftime: true, isFinished: false, half: 1 };
  }

  const secondHalfElapsed = nowMs - anchor.secondHalfKickoffTs;
  const minute = HALFTIME_AT_MINUTE + Math.max(1, Math.floor((secondHalfElapsed / 1000) * anchor.compression));

  if (minute >= fullTime) {
    return { minute: fullTime, label: "FT", isHalftime: false, isFinished: true, half: 2 };
  }
  const label = minute > 90 ? `90+${minute - 90}'` : `${minute}'`;
  return { minute, label, isHalftime: false, isFinished: false, half: 2 };
}
