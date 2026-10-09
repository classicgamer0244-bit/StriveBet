import type { Transaction } from "@prisma/client";
import { fromMinor } from "@/lib/money";

const TYPE_MAP = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  ADJUSTMENT: "adjustment",
  BET: "bet",
  WINNING: "winning",
  REFUND: "refund",
} as const;
const STATUS_MAP = { PENDING: "pending", SUCCESS: "success", FAILED: "failed" } as const;

export function serializeTransaction(t: Transaction) {
  return {
    id: t.id,
    accountId: t.accountId,
    type: TYPE_MAP[t.type],
    status: STATUS_MAP[t.status],
    amount: fromMinor(t.amountMinor),
    method: t.method,
    phone: t.phone,
    network: t.network ?? undefined,
    reference: t.reference,
    referringAdminId: t.referringAdminId ?? undefined,
    adminCommission: t.adminCommissionMinor !== null ? fromMinor(t.adminCommissionMinor) : undefined,
    superadminCommission: t.superadminCommissionMinor !== null ? fromMinor(t.superadminCommissionMinor) : undefined,
    performedByAdminId: t.performedByAdminId ?? undefined,
    note: t.note ?? undefined,
    createdAt: t.createdAt.toISOString(),
  };
}
