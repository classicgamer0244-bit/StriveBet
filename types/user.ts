export type Gender = "male" | "female" | "other" | "prefer-not-to-say";

export type UserRole = "user" | "admin" | "superadmin";
export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  phone: string;
  countryCode: string;
  countryFlag: string;
  avatarUrl?: string;
  balance: number;
  currency: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: Gender;
  /** Present on player accounts. Admins/superadmins live in AdminAccount. */
  role: UserRole;
  status: UserStatus;
  /** id of the AdminAccount that referred this user, if any. */
  referredBy?: string;
  /** Superadmin list only — resolved server-side, not fetched client-side. */
  referrerName?: string;
  /** Successful deposits since the last withdrawal-refund reset — gates
   * withdrawal eligibility (needs >= 3). */
  depositsSinceReset: number;
  /** True when this account must make a deposit >= 8% of its balance before
   * it can withdraw again (triggered every 2nd refund). */
  penaltyDepositRequired: boolean;
  /** True if this user has at least one settled WON bet. Used to gate the
   * withdrawal eligibility banner — we only show it once they've actually won. */
  hasWonBet: boolean;
  createdAt: string;
  depositCount?: number;
}
