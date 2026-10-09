"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

export default function AdminWithdrawalsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/admin/transactions", extraParams: { type: "withdrawal" } });

  return (
    <div>
      <OperatorPageHeader title="Withdrawals" description="Withdrawals from your referred users." />
      <TransactionsTable table={table} variant="withdrawals" />
    </div>
  );
}
