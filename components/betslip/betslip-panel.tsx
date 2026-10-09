"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiptText, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBetslip } from "@/hooks/use-betslip";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { CURRENCY, MIN_BET_AMOUNT } from "@/lib/constants";
import { getMultiBonusPercent } from "@/lib/betslip-labels";
import { BetslipSelectionRow } from "./betslip-selection-row";
import { BookingCodeInput } from "./booking-code-input";
import { BookingSuccessModal, type BookingSuccessInfo } from "./booking-success-modal";
import { CashoutTab } from "./cashout-tab";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function BetslipPanel() {
  const { selectionList, count, stake, setStake, totalOdds, potentialWinnings, mode, clearAll } = useBetslip();
  const { player, refreshBalance, applyPushedBalance } = useAuth();
  const { openLogin } = useUI();
  const [isBusy, setIsBusy] = useState(false);
  const [bookingInfo, setBookingInfo] = useState<BookingSuccessInfo | null>(null);

  const fmt = (n: number) => n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const bonusPercent = getMultiBonusPercent(count);
  const bonusAmount = (potentialWinnings * bonusPercent) / 100;
  const totalPotentialWin = potentialWinnings + bonusAmount;

  function selectionRefs() {
    return selectionList.map((s) => ({ fixtureId: s.fixtureId, marketId: s.marketId, selectionId: s.selectionId }));
  }

  async function handlePlaceBet() {
    if (!player) {
      toast.info("Log in to place this bet.");
      openLogin();
      return;
    }
    if (stake < MIN_BET_AMOUNT) {
      toast.error(`Minimum stake is ${CURRENCY} ${MIN_BET_AMOUNT.toLocaleString()}.`);
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: selectionRefs(), stake, mode }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't place that bet.");
        return;
      }
      toast.success(`${mode === "SIM" ? "Simulated bet" : "Bet"} placed: ${CURRENCY} ${stake.toFixed(2)} on ${count} selection${count === 1 ? "" : "s"}.`);
      clearAll();
      setStake(0);
      if (typeof data?.balance === "number") {
        applyPushedBalance(data.balance);
      }
      await refreshBalance();
      window.dispatchEvent(new Event("bets:placed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleBookBet() {
    if (count === 0) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: selectionRefs() }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't save that betslip.");
        return;
      }
      setBookingInfo({ code: data.code, count, totalOdds, expiresAt: data.expiresAt });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Tabs defaultValue="betslip" className="gap-0">
        <div className="bg-navy p-1.5">
          <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-10 rounded-xl bg-white/5 p-1">
            <TabsTrigger
              value="betslip"
              className="gap-1.5 rounded-lg text-sm font-bold text-white/60 hover:text-white data-active:hover:text-navy data-[state=active]:bg-volt data-[state=active]:text-navy data-active:bg-volt data-active:text-navy dark:data-active:border-transparent dark:data-active:bg-volt dark:data-active:text-navy"
            >
              <ReceiptText className="size-4" />
              Betslip
              {count > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">{count}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="cashout"
              className="rounded-lg text-sm font-bold text-white/60 hover:text-white data-active:hover:text-navy data-[state=active]:bg-volt data-[state=active]:text-navy data-active:bg-volt data-active:text-navy dark:data-active:border-transparent dark:data-active:bg-volt dark:data-active:text-navy"
            >
              Cashout
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="betslip" className="p-3">
          <div className="mb-3 flex items-center justify-between">
            {/* SIM is retired now the platform is live — every bet is real
                money. The control keeps its original REAL/SIM labels and
                layout, but SIM is permanently inactive: it can't be selected,
                and the server ignores whatever mode a client sends anyway
                (app/api/bets/route.ts). Leaving it selectable is what let
                players place simulated bets for days without realising, since
                the choice persisted in localStorage and no screen showed it. */}
            <div className="inline-flex rounded-full bg-muted p-0.5 text-[11px] font-bold">
              <span className="rounded-full bg-navy px-3 py-1 text-white">REAL</span>
              <span
                aria-disabled="true"
                title="SIM mode is no longer available — all bets are real money."
                className="cursor-not-allowed rounded-full px-3 py-1 text-muted-foreground/40"
              >
                SIM
              </span>
            </div>
            {selectionList.length > 0 && (
              <button onClick={clearAll} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
                Clear all
              </button>
            )}
          </div>

          {selectionList.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ReceiptText className="size-5" />
                </span>
                <p className="text-sm font-bold text-foreground">Your betslip is empty</p>
                <p className="text-xs text-muted-foreground">Tap any odds to add a selection, or load a booking code below.</p>
              </div>
              <BookingCodeInput />
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border px-3">
                {selectionList.map((s) => (
                  <BetslipSelectionRow key={s.key} selection={s} />
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {count > 1 ? `Multiple · ${count}` : "Single"}
                </span>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-bold text-muted-foreground">{CURRENCY}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={stake || ""}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    className="h-10 rounded-xl pl-12 text-right text-base font-bold"
                    placeholder="Stake"
                    aria-label={`Stake (${CURRENCY})`}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total odds</span>
                  <span className="font-bold text-foreground tabular-nums">{fmt(totalOdds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total stake</span>
                  <span className="font-bold text-foreground tabular-nums">{fmt(stake)}</span>
                </div>
                {bonusPercent > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max bonus ({bonusPercent}%)</span>
                    <span className="font-bold text-success tabular-nums">+{fmt(bonusAmount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-end justify-between border-t border-border pt-2">
                  <span className="font-semibold text-foreground">Potential win</span>
                  <span className="text-lg font-extrabold text-primary tabular-nums">{CURRENCY} {fmt(totalPotentialWin)}</span>
                </div>
              </div>

              <Button
                onClick={handlePlaceBet}
                disabled={isBusy || stake < MIN_BET_AMOUNT}
                className="mt-3 h-12 w-full rounded-xl bg-volt text-base font-extrabold text-navy hover:bg-volt/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              >
                {isBusy
                  ? <div className="size-5 animate-spin rounded-full border-2 border-navy/30 border-t-navy" />
                  : stake > 0 && stake < MIN_BET_AMOUNT ? `Min. stake is ${CURRENCY} ${MIN_BET_AMOUNT.toLocaleString()}` : "Place Bet"
                }
              </Button>

              <button
                onClick={handleBookBet}
                disabled={isBusy}
                className="mt-2 h-10 w-full rounded-xl border border-border text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Book Bet & Share Code
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cashout">
          <CashoutTab />
        </TabsContent>
      </Tabs>

      <BookingSuccessModal info={bookingInfo} onOpenChange={(open) => !open && setBookingInfo(null)} />
    </div>
  );
}