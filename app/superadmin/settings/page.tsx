"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OperatorPageHeader, OperatorPanel } from "@/components/admin/operator-page";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CURRENCY } from "@/lib/constants";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SuperadminSettingsPage() {
  const [minDepositAmount, setMinDepositAmount] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState<boolean>(true);
  const [isTogglingDeposits, setIsTogglingDeposits] = useState(false);

  const [earnings, setEarnings] = useState<number | null>(null);
  const [depositsTotal, setDepositsTotal] = useState<number | null>(null);
  const [depositsResetAt, setDepositsResetAt] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/superadmin/overview", { cache: "no-store" });
    const data = await readJson(res);
    if (!res.ok || !data) return;
    setEarnings(typeof data.earnings === "number" ? data.earnings : null);
    setDepositsTotal(typeof data.depositsTotal === "number" ? data.depositsTotal : null);
    setDepositsResetAt(data.depositsResetAt ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled && typeof data?.minDepositAmount === "number") {
        setMinDepositAmount(data.minDepositAmount);
        setInput(data.minDepositAmount.toFixed(2));
      }
      if (!cancelled && typeof data?.depositsEnabled === "boolean") {
        setDepositsEnabled(data.depositsEnabled);
      }
      // Inside the async IIFE so the state updates land after an await rather
      // than synchronously in the effect body.
      await loadOverview();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOverview]);

  const amountNum = Number(input);
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !isBusy;

  async function handleToggleDeposits(enabled: boolean) {
    setIsTogglingDeposits(true);
    try {
      const res = await fetch("/api/superadmin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositsEnabled: enabled }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't update the setting.");
        return;
      }
      setDepositsEnabled(data.depositsEnabled);
      toast.success(data.depositsEnabled ? "Deposits are now enabled." : "Deposits are now disabled.");
    } finally {
      setIsTogglingDeposits(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/superadmin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minDepositAmount: amountNum }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't update the setting.");
        return;
      }
      setMinDepositAmount(data.minDepositAmount);
      toast.success(`Minimum deposit is now ${CURRENCY} ${data.minDepositAmount.toFixed(2)}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function runReset(target: "deposits" | "earnings", restore = false) {
    const label =
      target === "earnings"
        ? "Clear your earnings ledger? The figure resets to zero."
        : restore
          ? "Show all deposit history in the totals again?"
          : "Clear the deposit totals on the overview? Transactions are kept — only the dashboard figure resets.";
    if (!window.confirm(label)) return;

    setBusyAction(target);
    try {
      const res = await fetch("/api/superadmin/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, restore }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't clear that.");
        return;
      }
      toast.success(data?.message ?? "Done.");
      await loadOverview();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runReconcile() {
    setBusyAction("reconcile");
    try {
      const res = await fetch("/api/superadmin/deposits/reconcile", { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) {
        // A configuration problem needs to stay on screen long enough to read
        // and act on — it names the env var to fix.
        toast.error(data?.error ?? "Couldn't run the check.", {
          duration: data?.configuration ? 30_000 : undefined,
        });
        return;
      }
      const recovered = (data.credited ?? 0) + (data.recovered ?? 0);
      if (recovered > 0) {
        toast.success(
          `Credited ${recovered} deposit${recovered === 1 ? "" : "s"} that hadn't come through.`
        );
      } else if (data.mismatched > 0) {
        toast.warning(
          `${data.mismatched} payment${data.mismatched === 1 ? "" : "s"} need manual review — check the server logs.`
        );
      } else {
        toast.success(`Checked ${data.checked ?? 0} deposit${data.checked === 1 ? "" : "s"} — all up to date.`);
      }
      await loadOverview();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  const clearedOn = formatWhen(depositsResetAt);

  return (
    <div className="flex flex-col gap-4">
      <OperatorPageHeader title="Settings" description="Platform-wide settings, editable at any time." />

      <OperatorPanel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Accept deposits</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When off, the deposit button is disabled for all players.
            </p>
          </div>
          <Switch
            checked={depositsEnabled}
            onCheckedChange={handleToggleDeposits}
            disabled={isTogglingDeposits}
          />
        </div>
      </OperatorPanel>

      <OperatorPanel>
        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
          <div>
            <Label className="mb-1.5">Minimum deposit amount ({CURRENCY})</Label>
            <Input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" placeholder="e.g. 5.00" />
            {minDepositAmount !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Current: {CURRENCY} {minDepositAmount.toFixed(2)}
              </p>
            )}
          </div>
          <Button type="submit" disabled={!canSubmit} className="w-fit">
            Save
          </Button>
        </form>
      </OperatorPanel>

      <OperatorPanel>
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-bold text-foreground">Clear dashboard totals</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Resets the running figures on the overview once they cover too long a period.
              Nothing is deleted — every transaction stays on record, and player balances
              and histories are untouched.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <div className="flex flex-col items-start gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Your earnings</p>
                <p className="text-lg font-bold text-foreground">
                  {earnings === null ? "…" : `${CURRENCY} ${earnings.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== null || earnings === 0}
                onClick={() => runReset("earnings")}
              >
                {busyAction === "earnings" ? "Clearing…" : "Clear earnings"}
              </Button>
            </div>

            <div className="flex flex-col items-start gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Total deposits</p>
                <p className="text-lg font-bold text-foreground">
                  {depositsTotal === null ? "…" : `${CURRENCY} ${depositsTotal.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`}
                </p>
                {clearedOn && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Counting from {clearedOn}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyAction !== null}
                  onClick={() => runReset("deposits")}
                >
                  {busyAction === "deposits" ? "Clearing…" : "Clear deposit totals"}
                </Button>
                {depositsResetAt && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busyAction !== null}
                    onClick={() => runReset("deposits", true)}
                  >
                    Show all history
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </OperatorPanel>

      <OperatorPanel>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Check for missing deposits</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Re-checks recent deposits against Flutterwave and credits any that were paid
              but never came through — for when a player says they were debited and nothing
              arrived. This runs automatically every ten minutes; use this to check right now.
            </p>
          </div>
          <Button
            type="button"
            disabled={busyAction !== null}
            onClick={runReconcile}
            className="w-fit"
          >
            {busyAction === "reconcile" ? "Checking…" : "Check now"}
          </Button>
        </div>
      </OperatorPanel>
    </div>
  );
}
