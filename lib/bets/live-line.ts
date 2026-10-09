import { computeMatchPhase } from "@/lib/simulation/phase";
import { needsRegulationScore, resolveLegResult, type LegResult } from "@/lib/settlement/resolve-leg";
import type { BetFixtureState } from "./fixture-state";

/** Half derived from a real fixture's pre-formatted minute label — real
 * fixtures never surface as our "halftime" status (api-football's HT status
 * code collapses into "live", see lib/api-football/status.ts), so this is
 * the only signal available for which half is playing. */
function halfFromRealMinute(minute: string | undefined): 1 | 2 {
  if (!minute) return 1;
  const n = Number.parseInt(minute, 10);
  if (Number.isNaN(n)) return 1; // "HT"/"FT" — doesn't matter which we report once finished
  return n <= 45 ? 1 : 2;
}

export interface LiveLine {
  text: string;
  /** True once the match has a final result (FT/cancelled) — callers style
   * this muted/gray instead of the "in play" green, and it never changes
   * back once true. */
  isFinal: boolean;
}

/** The "63' H2 | 0:1" line shown under a leg's team names once its fixture
 * has kicked off — undefined while still upcoming (callers show the kickoff
 * timestamp instead) or when state is unknown. Pure/client-safe: admin
 * fixtures recompute their minute locally from `phase` every render (no
 * network needed between SSE pushes), matching hooks/use-fixtures.ts.
 *
 * The client's local clock crosses full time up to a few seconds before the
 * server's throttled tick flips the fixture's stored status to "finished" —
 * `phase.isFinished` is checked explicitly here so both paths render the
 * identical "FT | score" text instead of briefly disagreeing (which read as
 * a flicker: the H-suffix form, then the no-suffix form a few seconds later). */
export function formatLiveLine(state: BetFixtureState | undefined, nowMs: number): LiveLine | undefined {
  if (!state) return undefined;

  // Postponed/cancelled/abandoned (admin-cancelled, or a real fixture's
  // PST/CANC/ABD/AWD/WO — see lib/api-football/status.ts) is treated as
  // ended with no result: the match will never produce a score, so it
  // renders exactly like a finished match's "FT" line, just with no score
  // to show — this is what lets it settle VOID and drop out of Open Bets
  // the same way a normal finished match does, rather than needing its own
  // separate "cancelled" branch through the UI.
  if (state.status === "cancelled") return { text: "FT | _:_", isFinal: true };
  if (state.status === "upcoming") return undefined;

  const score = state.score ? `${state.score.home}:${state.score.away}` : "-:-";

  if (state.status === "finished") return { text: `FT | ${score}`, isFinal: true };

  if (state.phase) {
    // Admin-simulated fixture — derive fresh from the anchor, never trust a
    // possibly-stale stored label.
    const phase = computeMatchPhase(state.phase, nowMs);
    if (phase.isFinished) return { text: `FT | ${score}`, isFinal: true };
    if (phase.isHalftime) return { text: `HT | ${score}`, isFinal: false };
    return { text: `${phase.label} H${phase.half} | ${score}`, isFinal: false };
  }

  // Real (api-football) fixture — minute comes pre-formatted from upstream.
  if (state.minute === "HT") return { text: `HT | ${score}`, isFinal: false };
  if (!state.minute) return { text: `${state.status === "live" ? "LIVE" : state.status} | ${score}`, isFinal: false };
  // Non-football sports report a period ("2nd quarter", "1st set"), not a minute.
  if (!/^\d/.test(state.minute)) return { text: `${state.minute} | ${score}`, isFinal: false };
  return { text: `${state.minute} H${halfFromRealMinute(state.minute)} | ${score}`, isFinal: false };
}

/**
 * A leg's outcome as soon as ITS OWN fixture finishes — independent of
 * whether the overall bet has settled yet. Settlement only writes
 * `leg.result` once every leg in the bet is done (lib/settlement/settle-bet.ts),
 * so a multi-leg open bet with one finished leg and one still live has no
 * persisted result for that finished leg yet. This recomputes it client-side
 * with the same pure resolver settlement itself uses, purely for display
 * (the "clock -> tick" badge) — never written back, and settlement always
 * has the final say when the whole bet is ready. */
export function legLiveResult(
  leg: { marketName: string; selectionLabel: string },
  state: BetFixtureState | undefined
): LegResult | undefined {
  if (!state || state.status !== "finished" || !state.score) return undefined;
  // Regulation-time legs need a score the display state doesn't carry — leave
  // them to settlement rather than showing a misleading badge.
  if (needsRegulationScore(leg.marketName)) return undefined;
  return resolveLegResult(leg, state.score);
}
