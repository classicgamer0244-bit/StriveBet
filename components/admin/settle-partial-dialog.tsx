"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { money } from "@/lib/format-money";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

/** Partial alternative to the one-click "Settle & reset earnings" button —
 * for a superadmin paying a merchant's unpaid commission out in
 * installments rather than all at once. Posts to the same
 * .../reset-earnings endpoint as the full settle, just with an amount:
 * that route decrements the ledger by exactly this much instead of
 * zeroing it. */
export function SettlePartialDialog({
  accountId,
  accountLabel,
  maxAmount,
  onSettled,
}: {
  accountId: string;
  accountLabel: string;
  /** Current unpaid earnings, in major (GHS) units — caps what can be entered. */
  maxAmount: number;
  onSettled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const parsedAmount = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxAmount;
  const canSubmit = amountValid && !isBusy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/superadmin/admins/${accountId}/reset-earnings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't settle that amount.");
        return;
      }
      toast.success(`Settled ${money(parsedAmount)} of ${accountLabel}'s earnings.`);
      setAmount("");
      setOpen(false);
      onSettled?.();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={maxAmount === 0}>
          <HandCoins className="size-4" />
          Partial settlement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Partially settle {accountLabel}&apos;s earnings</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5">Amount (GHS)</Label>
            <Input
              type="number"
              min="0.01"
              max={maxAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-muted-foreground">Up to {money(maxAmount)} unpaid.</p>
          </div>
          <Button type="submit" disabled={!canSubmit} className="mt-1">
            Settle {amountValid ? money(parsedAmount) : "amount"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
