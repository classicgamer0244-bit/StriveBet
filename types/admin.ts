export type AdminRole = "admin" | "superadmin";
export type AdminStatus = "pending" | "active" | "suspended";

export interface AdminAccount {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  /** Referral code users sign up with to be tracked under this admin. */
  referralCode: string;
  role: AdminRole;
  status: AdminStatus;
  /** id of the admin/superadmin who created this account. */
  createdByAdminId?: string;
  /** Running commission earnings ledger, in the platform currency. */
  earnings: number;
  /** Own betting wallet — separate from `earnings`. Admins/superadmins can
   * deposit, stake, and withdraw just like a player. */
  balance: number;
  currency: string;
  /** Successful deposits since the last withdrawal-refund reset — gates
   * withdrawal eligibility (needs >= 3). */
  depositsSinceReset: number;
  /** True when this account must make a deposit >= 8% of its balance before
   * it can withdraw again (triggered every 2nd refund). */
  penaltyDepositRequired: boolean;
  createdAt: string;
}
