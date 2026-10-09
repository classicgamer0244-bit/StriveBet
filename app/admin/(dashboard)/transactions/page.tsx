"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

export default function AdminTransactionsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/admin/transactions" });

  return (
    <div>
      <OperatorPageHeader title="Transactions" description="All money movement for your referred users." />
      <TransactionsTable table={table} variant="all" />
    </div>
  );
}
