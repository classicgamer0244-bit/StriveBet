"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { TransactionsTable } from "@/components/admin/transactions-table";
import { useServerTable } from "@/hooks/use-server-table";
import { ADMIN_COMMISSION_SHARE, SUPERADMIN_COMMISSION_SHARE } from "@/lib/constants";
import type { Transaction } from "@/types";

export default function SuperadminDepositsPage() {
  const table = useServerTable<Transaction>({ endpoint: "/api/superadmin/transactions", extraParams: { type: "deposit" } });

  return (
    <div>
      <OperatorPageHeader
        title="Deposits"
        description={`All deposits and their commission splits (${Math.round(ADMIN_COMMISSION_SHARE * 100)}% admin / ${Math.round(SUPERADMIN_COMMISSION_SHARE * 100)}% you).`}
      />
      <TransactionsTable table={table} variant="deposits" showCommission />
    </div>
  );
}
