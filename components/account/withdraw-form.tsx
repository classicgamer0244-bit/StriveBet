"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Info, Construction } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { MIN_WITHDRAWAL_AMOUNT, CURRENCY } from "@/lib/constants";
import { checkWithdrawalEligibility } from "@/lib/withdrawal-eligibility";
import { PaymentMethodSwitch } from "./payment-method-switch";

type WithdrawTab = "mobile-money" | "bank";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function WithdrawForm() {
  const { player, refreshBalance } = useAuth();
  const [tab, setTab] = useState<WithdrawTab>("mobile-money");
  const [provider, setProvider] = useState("MTN Mobile Money");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  useEffect(() => {
    fetch("/api/bets/wins")
      .then((r) => r.json())
      .then((d) => { if (d?.hasWon) setHasWon(true); })
      .catch(() => {});
  }, []);

  const balance = player?.balance ?? 0;
  const depositsSinceReset = player?.depositsSinceReset ?? 0;
  const isAdmin = player?.kind === "admin";
  const eligibility = checkWithdrawalEligibility({
    depositsSinceReset,
    penaltyDepositRequired: player?.penaltyDepositRequired ?? false,
    balance,
    isAdmin,
  });
  // Show the banner once the user has won at least one bet — no point
  // nagging someone who hasn't had a winning game yet.
  const showEligibilityBanner = !eligibility.eligible && hasWon && balance >= MIN_WITHDRAWAL_AMOUNT;
  const amountNum = Number(amount) || 0;
  const isValidAmount = amountNum >= MIN_WITHDRAWAL_AMOUNT && amountNum <= balance;
  const tabDetailsValid = tab === "mobile-money" && phone.trim().length >= 6;
  const canSubmit = isValidAmount && tabDetailsValid && !isBusy && eligibility.eligible;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, phone: phone.trim(), network: provider }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Withdrawal failed.");
        return;
      }
      toast.success(`Withdrawal request of ${CURRENCY} ${amountNum.toFixed(2)} to ${provider} submitted — pending review.`);
      setAmount("");
      await refreshBalance();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {showEligibilityBanner && (
        <div className="flex items-start gap-2 border-b border-border bg-primary/10 px-4 py-3 text-sm text-primary">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>{eligibility.reason}</p>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as WithdrawTab)}>
        <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border px-4 pt-1">
          <TabsTrigger value="mobile-money" className="py-2.5 text-sm font-semibold">
            Mobile Money
          </TabsTrigger>
          <TabsTrigger value="bank" className="py-2.5 text-sm font-semibold">
            Bank Transfer
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit} className="p-4">
          <TabsContent value="mobile-money" className="mt-0 flex flex-col gap-3">
            <p className="mb-1 text-xs font-bold text-muted-foreground uppercase">Payment Info</p>
            <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-primary-50 text-xs font-extrabold text-primary-700">
                  M
                </span>
                <span className="text-sm font-semibold text-foreground">{provider}</span>
                <PaymentMethodSwitch value={provider} onChange={setProvider} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Mobile money number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter mobile money number"
                inputMode="numeric"
              />
            </div>
          </TabsContent>

          <TabsContent value="bank" className="mt-0">
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-10 text-center">
              <Construction className="size-6 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Coming soon</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Bank transfer withdrawals aren&apos;t available yet — use Mobile Money for now.
              </p>
            </div>
          </TabsContent>

          {tab === "mobile-money" && (
            <>
              <div className="mt-4 flex items-center justify-between">
                <Label>Amount ({CURRENCY})</Label>
                <span className="text-xs text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">{CURRENCY} {balance.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </span>
              </div>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`min. ${MIN_WITHDRAWAL_AMOUNT.toLocaleString("en-GH")}`}
                inputMode="decimal"
                className="mt-1.5"
              />
              {amountNum > balance && amountNum > 0 && (
                <p className="mt-1.5 text-xs font-medium text-destructive">Amount exceeds your available balance.</p>
              )}

              <Button type="submit" disabled={!canSubmit} className="mt-4 h-11 w-full text-base">
                Withdraw Now
              </Button>
            </>
          )}
        </form>
      </Tabs>

      {tab === "mobile-money" && (
        <div className="border-t border-border p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Note</h3>
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-muted-foreground">
            <li>Minimum withdrawal amount is {CURRENCY} {MIN_WITHDRAWAL_AMOUNT.toLocaleString("en-GH")}.</li>
            <li>Withdrawals are free, no transaction fees.</li>
            <li>Bank transfer withdrawals are coming soon. Mobile Money is available now.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
