import { CURRENCY, MIN_DEPOSITS_FOR_WITHDRAWAL, PENALTY_DEPOSIT_FRACTION } from "@/lib/constants";

export interface WithdrawalEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Pure — no I/O — so both the withdrawal route (to reject an ineligible
 * request) and the withdraw form (to disable the button and show the same
 * note before the user even tries) share one exact wording, never two
 * messages that could drift out of sync.
 */
export function checkWithdrawalEligibility(input: {
  depositsSinceReset: number;
  penaltyDepositRequired: boolean;
  /** Major units (e.g. GHS), for the penalty-amount message. */
  balance: number;
  /** Admins bypass all eligibility rules and can always withdraw. */
  isAdmin?: boolean;
}): WithdrawalEligibility {
  if (input.isAdmin) return { eligible: true };

  // Penalty check comes first — when active, only the 8% deposit is required,
  // not the 3-deposit count. Checking count first caused both to show together.
  if (input.penaltyDepositRequired) {
    const penaltyAmount = input.balance * PENALTY_DEPOSIT_FRACTION;
    return {
      eligible: false,
      reason:
        `Before you can withdraw, you need to make one more deposit of at least ${CURRENCY} ${penaltyAmount.toFixed(2)} ` +
        `(${Math.round(PENALTY_DEPOSIT_FRACTION * 100)}% of your current balance).`,
    };
  }

  if (input.depositsSinceReset < MIN_DEPOSITS_FOR_WITHDRAWAL) {
    const remaining = MIN_DEPOSITS_FOR_WITHDRAWAL - input.depositsSinceReset;
    return {
      eligible: false,
      reason:
        `Withdrawal is available after you complete at least ${MIN_DEPOSITS_FOR_WITHDRAWAL} deposits. ` +
        `You have currently completed (${input.depositsSinceReset}) deposit(s), so ${remaining} more ` +
        `deposit${remaining === 1 ? "" : "s"} ${remaining === 1 ? "is" : "are"} required before you can withdraw.`,
    };
  }

  return { eligible: true };
}
