"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money, shortDateTime } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { PaginatedDataTable } from "./paginated-data-table";
import { DateRangeFilter } from "./date-range-filter";
import type { Column } from "./data-table";
import type { useServerTable } from "@/hooks/use-server-table";
import type { Transaction } from "@/types";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

export function TransactionsTable({
  table,
  variant,
  showCommission = false,
  refundable = false,
}: {
  table: ReturnType<typeof useServerTable<Transaction>>;
  variant: "deposits" | "withdrawals" | "all";
  showCommission?: boolean;
  /** Superadmin only: allow reversing a failed withdrawal (credit the user back). */
  refundable?: boolean;
}) {
  async function refund(t: Transaction) {
    const res = await fetch(`/api/superadmin/withdrawals/${t.id}/refund`, { method: "POST" });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't refund that withdrawal.");
      return;
    }
    toast.success(`Refunded ${money(t.amount)} to the user's balance.`);
    table.refresh();
  }

  async function refundAll() {
    if (!window.confirm("Refund every pending withdrawal? This credits each one back to the user's balance and cannot be undone.")) {
      return;
    }
    const res = await fetch("/api/superadmin/withdrawals/refund-all", { method: "POST" });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't refund pending withdrawals.");
      return;
    }
    if (data.total === 0) {
      toast.info("No pending withdrawals to refund.");
    } else if (data.failed > 0) {
      toast.warning(`Refunded ${data.refunded} of ${data.total} (${data.failed} failed — check logs).`);
    } else {
      toast.success(`Refunded ${data.refunded} withdrawal${data.refunded === 1 ? "" : "s"} — ${money(data.refundedAmount)} total.`);
    }
    table.refresh();
  }

  const columns: Column<Transaction>[] = [
    { header: "Date", cell: (t) => <span className="text-muted-foreground">{shortDateTime(t.createdAt)}</span> },
    { header: "User", cell: (t) => <span className="font-medium">{t.userLabel ?? t.accountId}</span> },
  ];

  if (variant === "all") {
    columns.push({
      header: "Type",
      cell: (t) => <span className="capitalize">{t.type}</span>,
    });
  }

  columns.push(
    { header: "Amount", align: "right", cell: (t) => <span className="font-bold tabular-nums">{money(t.amount)}</span> },
    { header: "Method", cell: (t) => <span className="text-muted-foreground">{t.method}</span> }
  );

  if (showCommission) {
    columns.push(
      {
        header: "Admin cut",
        align: "right",
        cell: (t) => (
          <span className="tabular-nums text-success">{t.adminCommission ? money(t.adminCommission) : "—"}</span>
        ),
      },
      {
        header: "SA cut",
        align: "right",
        cell: (t) => (
          <span className="tabular-nums text-success">
            {t.superadminCommission ? money(t.superadminCommission) : "—"}
          </span>
        ),
      }
    );
  }

  columns.push({
    header: "Status",
    cell: (t) => (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
          t.status === "failed"
            ? "bg-destructive/10 text-destructive"
            : t.status === "pending"
              ? "bg-primary/15 text-primary"
              : "bg-success/15 text-success"
        )}
      >
        {t.status}
      </span>
    ),
  });

  if (refundable) {
    columns.push({
      header: "Actions",
      align: "right",
      cell: (t) =>
        t.type === "withdrawal" && t.status === "pending" ? (
          <Button size="sm" variant="outline" onClick={() => refund(t)}>
            Refund
          </Button>
        ) : t.type === "withdrawal" && t.status === "failed" ? (
          <span className="text-xs text-muted-foreground">Refunded</span>
        ) : null,
    });
  }

  const empty =
    variant === "deposits" ? "No deposits yet." : variant === "withdrawals" ? "No withdrawals yet." : "No transactions yet.";

  return (
    <PaginatedDataTable
      table={table}
      columns={columns}
      keyOf={(t) => t.id}
      empty={empty}
      searchPlaceholder="Search by phone or reference…"
      statusOptions={STATUS_OPTIONS}
      toolbarEnd={
        <div className="flex items-center gap-2">
          {refundable && (
            <Button size="sm" variant="outline" onClick={refundAll}>
              Refund all pending
            </Button>
          )}
          <DateRangeFilter from={table.from} to={table.to} onChange={(from, to) => { table.setFrom(from); table.setTo(to); }} />
        </div>
      }
    />
  );
}
