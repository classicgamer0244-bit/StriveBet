"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { money, shortDateTime } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { PaginatedDataTable } from "./paginated-data-table";
import { CreditBalanceDialog } from "./credit-balance-dialog";
import type { Column } from "./data-table";
import type { useServerTable } from "@/hooks/use-server-table";
import type { User } from "@/types";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-semibold tabular-nums", accent ? "text-success" : "text-foreground")}>{value}</span>
    </div>
  );
}

function DetailRowStacked({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-all text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

interface UserDetail {
  user: User & { referrerName?: string | null };
  totalDeposited: number;
  depositCount: number;
  totalStaked: number;
  betCount: number;
}

export function UsersTable({
  table,
  manageable = false,
  showReferrer = false,
}: {
  table: ReturnType<typeof useServerTable<User>>;
  manageable?: boolean;
  showReferrer?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  function closeSheet(open: boolean) {
    if (!open) {
      setSelectedId(null);
      setDetail(null);
    }
  }

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/superadmin/users/${id}`, { cache: "no-store" });
    const data = await readJson(res);
    if (res.ok) setDetail(data);
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/superadmin/users/${selectedId}`, { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled) {
        setDetail(res.ok ? data : null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  async function setStatus(userId: string, status: "active" | "suspended") {
    const res = await fetch(`/api/superadmin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't update that user.");
      return;
    }
    toast.success(status === "suspended" ? "User suspended." : "User reactivated.");
    table.refresh();
    if (selectedId) refreshDetail(selectedId);
  }

  const columns: Column<User>[] = [
    {
      header: "Player",
      cell: (u) => (
        <div>
          <p className="font-semibold">{`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.phone}</p>
          <p className="text-xs text-muted-foreground">
            {u.countryCode} {u.phone}
          </p>
          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
        </div>
      ),
    },
  ];

  if (showReferrer) {
    columns.push({ header: "Referred by", cell: (u) => <span className="text-muted-foreground">{u.referrerName ?? "Direct"}</span> });
  }

  columns.push(
    { header: "Joined", cell: (u) => <span className="text-muted-foreground">{shortDateTime(u.createdAt)}</span> },
    { header: "Deposits", align: "right", cell: (u) => <span className="tabular-nums font-semibold">{u.depositCount ?? 0}</span> },
    { header: "Balance", align: "right", cell: (u) => <span className="font-bold tabular-nums">{money(u.balance)}</span> },
    {
      header: "Status",
      cell: (u) => (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
            u.status === "suspended" ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"
          )}
        >
          {u.status}
        </span>
      ),
    }
  );

  const u = detail?.user;
  const label = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.phone : "";

  return (
    <div className="flex flex-col gap-3">
      <PaginatedDataTable
        table={table}
        columns={columns}
        keyOf={(u) => u.id}
        empty="No players yet."
        searchPlaceholder="Search by name, phone or email…"
        statusOptions={STATUS_OPTIONS}
        onRowClick={manageable ? (u) => setSelectedId(u.id) : undefined}
      />

      {manageable && (
        <Sheet open={selectedId !== null} onOpenChange={closeSheet}>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <div className="size-6 animate-spin rounded-full border-2 border-border border-t-[#1F6BFF]" />
              </div>
            )}
            {!loading && detail && u && (
              <>
                <SheetHeader className="border-b border-border">
                  <SheetTitle className="flex items-center gap-2">
                    {label}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                        u.status === "suspended" ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"
                      )}
                    >
                      {u.status}
                    </span>
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">{u.phone}</p>
                </SheetHeader>

                <div className="flex flex-col gap-5 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Balance</p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums">{money(u.balance)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Total deposited</p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums">{money(detail.totalDeposited)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Total staked</p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums">{money(detail.totalStaked)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Total bets</p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums">{detail.betCount}</p>
                    </div>
                  </div>

                  <div>
                    {u.email && <DetailRowStacked label="Email" value={u.email} />}
                    <DetailRow label="Country" value={`${u.countryFlag} ${u.countryCode}`} />
                    {u.gender && <DetailRow label="Gender" value={u.gender} />}
                    <DetailRow label="Referred by" value={u.referrerName ?? "Direct"} />
                    <DetailRow label="Deposits" value={String(detail.depositCount)} />
                    <DetailRow label="Joined" value={shortDateTime(u.createdAt)} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <CreditBalanceDialog
                      kind="user"
                      accountId={u.id}
                      accountLabel={label}
                      triggerSize="default"
                      triggerVariant="default"
                      triggerClassName="w-full"
                      onCredited={() => {
                        table.refresh();
                        refreshDetail(u.id);
                      }}
                    />
                    {u.status === "suspended" ? (
                      <Button variant="outline" onClick={() => setStatus(u.id, "active")}>
                        Reactivate
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setStatus(u.id, "suspended")}>
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
