"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

export default function AdminDepositsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/admin/transactions", extraParams: { type: "deposit" } });

  return (
    <div>
      <OperatorPageHeader title="Deposits" description="Deposits from your referred users, with your 70% commission." />
      <TransactionsTable table={table} variant="deposits" showCommission />
    </div>
  );
}
