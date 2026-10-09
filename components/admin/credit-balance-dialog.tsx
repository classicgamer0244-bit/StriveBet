"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { money } from "@/lib/format-money";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function CreditBalanceDialog({
  kind,
  accountId,
  accountLabel,
  triggerSize = "sm",
  triggerVariant = "outline",
  triggerClassName,
  onCredited,
}: {
  kind: "user" | "admin";
  accountId: string;
  accountLabel: string;
  triggerSize?: "sm" | "default";
  triggerVariant?: "outline" | "default";
  triggerClassName?: string;
  onCredited?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const parsedAmount = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSubmit = amountValid && !isBusy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/superadmin/${kind === "admin" ? "admins" : "users"}/${accountId}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, note: note.trim() || undefined }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't credit that balance.");
        return;
      }
      toast.success(`Credited ${money(parsedAmount)} to ${accountLabel}.`);
      setAmount("");
      setNote("");
      setOpen(false);
      onCredited?.();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant} className={triggerClassName}>
          <Wallet className="size-4" />
          Credit balance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Credit {accountLabel}&apos;s balance</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5">Amount (GHS)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label className="mb-1.5">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for this credit" />
          </div>
          <Button type="submit" disabled={!canSubmit} className="mt-1">
            Credit {amountValid ? money(parsedAmount) : "balance"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
