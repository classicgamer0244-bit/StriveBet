import type { FixtureStatus } from "@/types";

/**
 * api-football's status.short taxonomy, complete. The previous version put
 * PST/CANC/ABD in a "hide from listings" bucket that still mapped to
 * "upcoming" — so a postponed match's bets waited forever for a kickoff
 * that never came. It also mapped AWD/WO to "finished", settling bets
 * against a scoreline that was never played. Both are fixed here by routing
 * every terminal-but-unplayed code to the same "cancelled" domain status an
 * admin-cancelled fixture already uses — settlement already knows how to
 * void and refund that (lib/settlement/settle-bet.ts), so nothing downstream
 * needs to change, only this mapping.
 */
export const SCHEDULED_CODES = new Set(["TBD", "NS"]);
export const IN_PLAY_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
export const FINISHED_CODES = new Set(["FT", "AET", "PEN"]);
/** Terminal, but with no result our score-derived markets can settle from.
 * AWD (technical loss) and WO (walkover) DO have an official winner
 * upstream, but no playable scoreline — and every market we price resolves
 * from the final score — so they void and refund alongside PST/CANC/ABD
 * rather than being force-settled from a scoreline that never happened. */
export const VOID_CODES = new Set(["PST", "CANC", "ABD", "AWD", "WO"]);

export function mapFixtureStatus(shortCode: string): FixtureStatus {
  if (shortCode === "HT") return "halftime";
  if (IN_PLAY_CODES.has(shortCode)) return "live";
  if (FINISHED_CODES.has(shortCode)) return "finished";
  if (VOID_CODES.has(shortCode)) return "cancelled";
  if (SCHEDULED_CODES.has(shortCode)) return "upcoming";
  console.warn(`api-football: unrecognized fixture status code "${shortCode}", treating as upcoming.`);
  return "upcoming";
}

export function isInPlayStatus(shortCode: string): boolean {
  return shortCode === "HT" || IN_PLAY_CODES.has(shortCode);
}

export function isVoidStatus(shortCode: string): boolean {
  return VOID_CODES.has(shortCode);
}

/** Finished ∪ void — a fixture that will never move again, either because
 * it's over or because it's been called off. Settlement and the sync jobs'
 * status-transition diff both key off this. */
export function isTerminalStatus(shortCode: string): boolean {
  return FINISHED_CODES.has(shortCode) || VOID_CODES.has(shortCode);
}

/** Fixtures we deliberately hide from listings entirely — not a normal
 * upcoming/live/finished state a player would want to browse or bet on. */
export function shouldListFixture(shortCode: string): boolean {
  return !VOID_CODES.has(shortCode);
}

export function formatMinute(elapsed: number | null, shortCode: string): string | undefined {
  if (shortCode === "HT") return "HT";
  if (shortCode === "FT" || shortCode === "AET" || shortCode === "PEN") return "FT";
  if (shortCode === "SUSP") return "SUSP";
  if (shortCode === "INT") return "INT";
  if (shortCode === "P") return "PEN";
  if (shortCode === "BT") return "BT";
  if (shortCode === "PST") return "Postponed";
  if (shortCode === "CANC") return "Cancelled";
  if (shortCode === "ABD") return "Abandoned";
  if (shortCode === "AWD") return "Awarded";
  if (shortCode === "WO") return "Walkover";
  if (elapsed === null) return undefined;
  return `${elapsed}'`;
}
