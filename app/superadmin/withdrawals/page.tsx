"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

export default function SuperadminWithdrawalsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/superadmin/transactions", extraParams: { type: "withdrawal" } });

  return (
    <div>
      <OperatorPageHeader
        title="Withdrawals"
        description="All player withdrawals. Refund one back to a user's balance if it failed to pay out."
      />
      <TransactionsTable table={table} variant="withdrawals" refundable />
    </div>
  );
}
