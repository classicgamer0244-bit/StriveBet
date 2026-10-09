export type TransactionType = "deposit" | "withdrawal" | "adjustment" | "bet" | "winning" | "refund";
export type TransactionStatus = "pending" | "success" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  method: string;
  /** Player or staff account that made the transaction. */
  accountId: string;
  /** Referring admin at the time, if any. */
  referringAdminId: string | null;
  /** Deposit-only: commission booked to the referring admin (70% of pool). */
  adminCommission?: number;
  /** Deposit-only: commission booked to the superadmin (30% of pool, or all if no admin). */
  superadminCommission?: number;
  /** Freely entered at transaction time — not necessarily the account phone. */
  phone?: string;
  network?: string;
  /** Resolved server-side on admin/superadmin transaction lists only. */
  userLabel?: string;
  /** Adjustment-only: which superadmin performed the manual credit. */
  performedByAdminId?: string;
  /** Adjustment-only: optional reason the superadmin entered. */
  note?: string;
}
