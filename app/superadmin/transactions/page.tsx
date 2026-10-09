"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

export default function SuperadminTransactionsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/superadmin/transactions" });

  return (
    <div>
      <OperatorPageHeader title="Transactions" description="Every transaction across the platform." />
      <TransactionsTable table={table} variant="all" />
    </div>
  );
}
