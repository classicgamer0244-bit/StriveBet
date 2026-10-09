import type { BetFixtureState } from "./fixture-state";
import type { BetStatus } from "@/types";

export interface CashoutEligibilityInput {
  status: BetStatus;
  legs: Array<{ fixtureId: string }>;
}

/**
 * A bet can be cashed out for its stake only while every one of its legs'
 * fixtures hasn't kicked off yet — the instant any leg goes live, cashout
 * locks. A fixture id missing from `fixtureStates` is treated as "unknown",
 * not "safe" — we never cash out a bet we can't currently verify. Shared by
 * the API route (server-side re-check), the UI button/dialog, and the
 * "Cashout Available" filter chip — one definition of eligibility everywhere.
 */
export function isCashoutEligible(bet: CashoutEligibilityInput, fixtureStates: Map<string, BetFixtureState>): boolean {
  if (bet.status !== "open") return false;
  return bet.legs.every((leg) => fixtureStates.get(leg.fixtureId)?.status === "upcoming");
}
