"use client";

import { useState } from "react";
import { Camera, Check, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

const PRESET_AMOUNTS = [
  5_000,
  25_000,
  50_000,
  100_000,
  250_000,
  500_000,
  1_000_000,
];

export function ScreenshotBalanceModal({
  open,
  onOpenChange,
  currentBalance = 0,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance?: number;
  onSuccess?: (newBalance: number) => void;
}) {
  const { refreshBalance, applyPushedBalance } = useAuth();
  const [amountStr, setAmountStr] = useState<string>(
    currentBalance > 0 ? String(currentBalance) : "50000"
  );
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amountStr) || 0;

  async function handleSave(targetAmount?: number) {
    const amountToSave = targetAmount !== undefined ? targetAmount : parsedAmount;
    if (isNaN(amountToSave) || amountToSave < 0) {
      toast.error("Please enter a valid amount (0 or greater).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToSave }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to update display balance.");
        return;
      }

      // Optimistically update context immediately
      applyPushedBalance(amountToSave);
      await refreshBalance();

      toast.success(
        `Balance updated to GHS ${amountToSave.toLocaleString("en-GH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} for screenshots!`
      );

      if (onSuccess) onSuccess(amountToSave);
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong updating balance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-volt/15 text-volt">
              <Camera className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Set Screenshot Balance</DialogTitle>
              <DialogDescription className="text-xs">
                Set any custom amount to reflect in your balance pill & wallet for screenshots.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick presets */}
          <div>
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Quick Presets
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = parsedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountStr(String(amt))}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-volt text-navy shadow-sm ring-1 ring-volt"
                        : "border border-border bg-muted/60 text-foreground hover:bg-muted"
                    }`}
                  >
                    GHS {amt >= 1_000_000 ? `${amt / 1_000_000}M` : `${amt / 1_000}k`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label
              htmlFor="screenshot-balance-input"
              className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
            >
              Custom Amount (GHS)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                GHS
              </span>
              <Input
                id="screenshot-balance-input"
                type="number"
                step="any"
                min="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="e.g. 50000"
                className="h-10 pl-14 font-mono text-base font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Preview card */}
          <div className="rounded-lg border border-volt/20 bg-volt/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Will reflect in balance pill as:
              </span>
              <span className="font-mono text-base font-extrabold text-volt tabular-nums">
                GHS{" "}
                {parsedAmount.toLocaleString("en-GH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Disclaimer callout */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Sparkles className="size-4 shrink-0 text-volt mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-foreground">Screenshot Purpose Only:</strong> This changes
                your top-bar balance display and account wallet for promotional pictures. Your{" "}
                <span className="text-foreground font-semibold">real superadmin settlement deal</span>{" "}
                and 70% commission earnings remain accurately logged in your admin dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(0)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to 0.00
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave()}
              disabled={submitting}
              className="gap-1.5 bg-volt font-bold text-navy hover:bg-volt/85"
            >
              {submitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Apply Display Balance
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
