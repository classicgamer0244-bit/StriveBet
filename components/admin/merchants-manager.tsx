"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PasswordChecklist, isPasswordValid } from "@/components/auth/password-checklist";
import { money, shortDateTime } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { PaginatedDataTable } from "./paginated-data-table";
import { CreditBalanceDialog } from "./credit-balance-dialog";
import { SettlePartialDialog } from "./settle-partial-dialog";
import { useServerTable } from "@/hooks/use-server-table";
import type { Column } from "./data-table";
import type { AdminAccount } from "@/types";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const STATUS_STYLES: Record<AdminAccount["status"], string> = {
  pending: "bg-primary/15 text-primary",
  active: "bg-success/15 text-success",
  suspended: "bg-destructive/10 text-destructive",
};

function StatusPill({ status }: { status: AdminAccount["status"] }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLES[status])}>{status}</span>
  );
}

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

function CreateMerchantDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const canSubmit = displayName.trim() && email.trim() && phone.trim() && isPasswordValid(password) && !isBusy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/superadmin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), email: email.trim(), phone: phone.trim(), password }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't create that merchant.");
        return;
      }
      toast.success(`Merchant "${data.admin.displayName}" created (pending approval). Referral code: ${data.admin.referralCode}`);
      setDisplayName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setOpen(false);
      onCreated();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" />
          Create merchant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create merchant account</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5">Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Accra Agency" />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="merchant@example.com" />
          </div>
          <div>
            <Label className="mb-1.5">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244000000" />
          </div>
          <div>
            <Label className="mb-1.5">Initial password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Share this with the merchant"
            />
            <PasswordChecklist password={password} />
          </div>
          <Button type="submit" disabled={!canSubmit} className="mt-1">
            Create (pending approval)
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-success" : "text-foreground")}>{value}</span>
    </div>
  );
}

interface MerchantDetail {
  admin: AdminAccount;
  referredUsersCount: number;
  grossReceived: number;
}

export function MerchantsManager() {
  const table = useServerTable<AdminAccount>({ endpoint: "/api/superadmin/admins" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function closeSheet(open: boolean) {
    if (!open) {
      setSelectedId(null);
      setDetail(null);
    }
  }

  async function refreshDetail(id: string) {
    const res = await fetch(`/api/superadmin/admins/${id}`, { cache: "no-store" });
    const data = await readJson(res);
    if (res.ok) setDetail(data);
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/superadmin/admins/${selectedId}`, { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled) {
        setDetail(res.ok ? data : null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function setStatus(id: string, status: "active" | "suspended") {
    const res = await fetch(`/api/superadmin/admins/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't update that merchant.");
      return;
    }
    toast.success(status === "active" ? "Merchant approved/reactivated." : "Merchant suspended.");
    table.refresh();
    setDetail((d) => (d ? { ...d, admin: data.admin } : d));
  }

  async function deleteMerchant() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/superadmin/admins/${deleteTarget.id}`, { method: "DELETE" });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't delete that merchant.");
        return;
      }
      toast.success(`Merchant "${deleteTarget.displayName}" permanently deleted.`);
      setDeleteTarget(null);
      setSelectedId(null);
      setDetail(null);
      table.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  async function resetEarnings(id: string, displayName: string) {
    const res = await fetch(`/api/superadmin/admins/${id}/reset-earnings`, { method: "POST" });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't reset earnings.");
      return;
    }
    toast.success(`${displayName}'s earnings settled and reset to ${money(0)}.`);
    table.refresh();
    setDetail((d) => (d ? { ...d, admin: data.admin } : d));
  }

  async function settleAllEarnings() {
    if (
      !window.confirm(
        "Settle every merchant's unpaid earnings? This records a payout for each one and resets their earnings to zero — make sure you've actually paid them first."
      )
    ) {
      return;
    }
    const res = await fetch("/api/superadmin/admins/settle-all-earnings", { method: "POST" });
    const data = await readJson(res);
    if (!res.ok) {
      toast.error(data?.error ?? "Couldn't settle merchant earnings.");
      return;
    }
    if (data.total === 0) {
      toast.info("No merchants have unpaid earnings.");
    } else if (data.failed > 0) {
      toast.warning(`Settled ${data.settled} of ${data.total} (${data.failed} failed — check logs).`);
    } else {
      toast.success(`Settled ${data.settled} merchant${data.settled === 1 ? "" : "s"} — ${money(data.settledAmount)} total.`);
    }
    table.refresh();
    if (selectedId) refreshDetail(selectedId);
  }

  const columns: Column<AdminAccount>[] = [
    {
      header: "Merchant",
      cell: (a) => (
        <div>
          <p className="font-semibold">{a.displayName}</p>
          <p className="text-xs text-muted-foreground">{a.email}</p>
        </div>
      ),
    },
    { header: "Referral", cell: (a) => <span className="font-mono text-xs tracking-wider">{a.referralCode}</span> },
    { header: "Earnings", align: "right", cell: (a) => <span className="tabular-nums text-success">{money(a.earnings)}</span> },
    { header: "Status", cell: (a) => <StatusPill status={a.status} /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <PaginatedDataTable
        table={table}
        columns={columns}
        keyOf={(a) => a.id}
        empty="No merchants yet."
        onRowClick={(a) => setSelectedId(a.id)}
        searchPlaceholder="Search by name, email or phone…"
        statusOptions={STATUS_OPTIONS}
        toolbarEnd={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={settleAllEarnings}>
              Settle all earnings
            </Button>
            <CreateMerchantDialog onCreated={table.refresh} />
          </div>
        }
      />

      <Sheet open={selectedId !== null} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-border border-t-[#1F6BFF]" />
            </div>
          )}
          {!loading && detail && (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle className="flex items-center gap-2">
                  {detail.admin.displayName}
                  <StatusPill status={detail.admin.status} />
                </SheetTitle>
                <p className="text-sm text-muted-foreground">{detail.admin.email}</p>
              </SheetHeader>

              <div className="flex flex-col gap-5 p-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Total amount received</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{money(detail.grossReceived)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Lifetime gross deposits from their users, before any split. This figure is never cleared.
                  </p>
                </div>

                <div>
                  <DetailRow label="Phone" value={detail.admin.phone} />
                  <DetailRow label="Referral code" value={detail.admin.referralCode} />
                  <DetailRow label="Referred users" value={String(detail.referredUsersCount)} />
                  <DetailRow label="Joined" value={shortDateTime(detail.admin.createdAt)} />
                  <DetailRow label="Betting wallet balance" value={money(detail.admin.balance)} />
                  <DetailRow label="Unpaid earnings" value={money(detail.admin.earnings)} accent />
                </div>

                <div className="flex flex-col gap-2">
                  <CreditBalanceDialog
                    kind="admin"
                    accountId={detail.admin.id}
                    accountLabel={detail.admin.displayName}
                    triggerSize="default"
                    triggerVariant="default"
                    triggerClassName="w-full"
                    onCredited={() => {
                      table.refresh();
                      refreshDetail(detail.admin.id);
                    }}
                  />

                  <Button
                    variant="outline"
                    disabled={detail.admin.earnings === 0}
                    onClick={() => resetEarnings(detail.admin.id, detail.admin.displayName)}
                  >
                    Settle &amp; reset earnings
                  </Button>

                  <SettlePartialDialog
                    accountId={detail.admin.id}
                    accountLabel={detail.admin.displayName}
                    maxAmount={detail.admin.earnings}
                    onSettled={() => {
                      table.refresh();
                      refreshDetail(detail.admin.id);
                    }}
                  />

                  <Button
                    variant="destructive"
                    onClick={() => setDeleteTarget(detail.admin)}
                  >
                    Delete merchant permanently
                  </Button>

                  <div className="flex gap-2">
                    {detail.admin.status === "pending" && (
                      <Button className="flex-1" onClick={() => setStatus(detail.admin.id, "active")}>
                        Approve
                      </Button>
                    )}
                    {detail.admin.status !== "suspended" ? (
                      <Button variant="outline" className="flex-1" onClick={() => setStatus(detail.admin.id, "suspended")}>
                        Suspend
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1" onClick={() => setStatus(detail.admin.id, "active")}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete merchant permanently?</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.displayName}</strong> will be removed from the database. Their users stay active
              but lose the merchant link — all future deposits from those users go entirely to the superadmin with no
              admin cut.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteMerchant} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Yes, delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
