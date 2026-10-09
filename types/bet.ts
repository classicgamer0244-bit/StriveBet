import type { BetslipMode } from "@/context/betslip-context";

export type BetStatus = "open" | "won" | "lost" | "void" | "cashed_out";
export type LegResult = "won" | "lost" | "void";

/** A frozen snapshot of one selection at the time the bet was placed. */
export interface BetLeg {
  fixtureId: string;
  fixtureLabel: string;
  /** Short player-facing fixture reference, shown as "Game ID". */
  gameId?: string;
  kickoffAt?: string;
  marketId: string;
  marketName: string;
  /** Friendly display name, e.g. "Match Result" for marketName "1X2". */
  marketLabel: string;
  selectionId: string;
  selectionLabel: string;
  odds: number;
  result?: LegResult;
  /** Filled in at settlement alongside `result` — absent for legs that never
   * got a real score (cancelled fixture, or the bet was cashed out). */
  finalScore?: { home: number; away: number };
}

export interface PlacedBet {
  id: string;
  accountId: string;
  referringAdminId: string | null;
  placedAt: string;
  stake: number;
  mode: BetslipMode;
  totalOdds: number;
  potentialPayout: number;
  status: BetStatus;
  settledAt?: string;
  payout?: number;
  /** Set once the "you won!" celebration modal has been shown for this bet. */
  winNotifiedAt?: string;
  /** Set if this bet was placed from a loaded booking slip. */
  bookingCode?: string;
  /** Only set once this bet settles WON — see lib/bets/verification-code.ts. */
  verificationCode?: string;
  /** Set once the player cashes this bet out (status "cashed_out"). */
  cashedOutAt?: string;
  legs: BetLeg[];
}
