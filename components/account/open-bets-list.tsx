"use client";

import { useState } from "react";
import { ChevronUp, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useOpenBets } from "@/hooks/use-open-bets";
import { useAuth } from "@/hooks/use-auth";
import { useClockTick } from "@/hooks/use-clock-tick";
import { CURRENCY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatLiveLine, legLiveResult } from "@/lib/bets/live-line";
import { isCashoutEligible } from "@/lib/bets/cashout";
import { EmptyState } from "@/components/common/empty-state";
import { LegOutcomeIcon } from "@/components/bets/leg-outcome-icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PlacedBet } from "@/types";

export type OpenBetsFilter = "all" | "cashout" | "live";

const EMPTY_COPY: Record<OpenBetsFilter, { title: string; description: string }> = {
  all: { title: "No open bets", description: "Bets you place will show up here until they're settled." },
  cashout: { title: "No bets available for cashout", description: "Cashout unlocks for a bet until any of its matches kick off." },
  live: { title: "No bets with live games", description: "Bets with a match currently in play will show up here." },
};

export function OpenBetsList({ filter = "all" }: { filter?: OpenBetsFilter }) {
  const { openBets, fixtureStates, hydrated, refresh } = useOpenBets();
  const { refreshBalance, balanceVisible } = useAuth();
  const now = useClockTick(true);
  const [expandedBet, setExpandedBet] = useState<string | null>(null);
  const [cashoutTarget, setCashoutTarget] = useState<PlacedBet | null>(null);
  const [cashingOut, setCashingOut] = useState(false);

  const fmt = (n: number) => balanceVisible ? n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "••••••";
  const toggleBet = (betId: string) => setExpandedBet((prev) => (prev === betId ? null : betId));

  function isLive(bet: PlacedBet) {
    return bet.legs.some((leg) => {
      const status = fixtureStates.get(leg.fixtureId)?.status;
      return status === "live" || status === "halftime";
    });
  }

  const filteredBets = openBets.filter((bet) => {
    if (filter === "cashout") return isCashoutEligible(bet, fixtureStates);
    if (filter === "live") return isLive(bet);
    return true;
  });

  async function confirmCashout() {
    if (!cashoutTarget) return;
    setCashingOut(true);
    try {
      const res = await fetch(`/api/bets/${cashoutTarget.id}/cashout`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't cash out this bet.");
        return;
      }
      toast.success(`Cashed out ${CURRENCY} ${fmt(cashoutTarget.stake)}.`);
      await refreshBalance();
      refresh();
    } finally {
      setCashingOut(false);
      setCashoutTarget(null);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-[#1F6BFF]" />
      </div>
    );
  }

  if (filteredBets.length === 0) {
    const copy = EMPTY_COPY[filter];
    return (
      <div className="p-4">
        <EmptyState title={copy.title} description={copy.description} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-2 pb-[120px]">
        {filteredBets.map((bet) => {
          const isExpanded = expandedBet === bet.id;
          const firstLeg = bet.legs[0];
          const [homeName, awayName] = firstLeg.fixtureLabel.split(" vs ");
          const betIsLive = isLive(bet);
          const eligible = isCashoutEligible(bet, fixtureStates);
          const collapsedLiveLine = formatLiveLine(fixtureStates.get(firstLeg.fixtureId), now);

          return (
            <div key={bet.id} className="overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.1)] mb-2">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground text-[13px]">{bet.legs.length > 1 ? "Multiple" : "Single"}</span>
                  {/* Flagged from the moment it's placed, not just once it
                      settles — a player must never discover a bet was simulated
                      at the point they expect to be paid. */}
                  {bet.mode === "SIM" && (
                    <span className="rounded-[2px] bg-[#8A5A00] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      SIM
                    </span>
                  )}
                  {betIsLive && (
                    <span className="rounded-[2px] bg-[#1B7C33] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Live
                    </span>
                  )}
                </div>
                <a href={`/api/bets/${bet.id}/image`} target="_blank" rel="noreferrer" className="text-[#1B7C33]">
                  <Share2 className="size-3.5" />
                </a>
              </div>

              {/* Collapsed */}
              {!isExpanded && (
                <div className="flex items-center justify-between gap-3 p-3 cursor-pointer" onClick={() => toggleBet(bet.id)}>
                  <div className="flex flex-col gap-1">
                    <div className="text-[13px] text-foreground">
                      {homeName} <span className="text-[#999999]">vs</span> {awayName}
                      {bet.legs.length > 1 && <span className="text-[#999999]"> +{bet.legs.length - 1} more</span>}
                    </div>
                    {collapsedLiveLine && (
                      <div className={cn("text-[11px] font-semibold", collapsedLiveLine.isFinal ? "text-[#999999]" : "text-[#1B7C33]")}>
                        {collapsedLiveLine.text}
                      </div>
                    )}
                    <div className="text-[13px]">
                      <span className="text-[#999999]">Stake</span>{" "}
                      <span className="font-bold text-foreground">{balanceVisible ? `${CURRENCY} ` : ""}{fmt(bet.stake)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!eligible}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (eligible) setCashoutTarget(bet);
                    }}
                    className={cn(
                      "shrink-0 rounded-[4px] px-6 py-1.5 text-center",
                      eligible ? "bg-[#1F6BFF]" : "cursor-not-allowed bg-[#1F6BFF]/40"
                    )}
                  >
                    <div className="text-[13px] font-bold text-white">Cashout</div>
                    <div className="text-[13px] font-semibold text-white">{eligible ? `${balanceVisible ? `${CURRENCY} ` : ""}${fmt(bet.stake)}` : "Unavailable"}</div>
                  </button>
                </div>
              )}

              {/* Expanded */}
              {isExpanded && (
                <div className="flex flex-col">
                  <div className="flex flex-col cursor-pointer" onClick={() => toggleBet(bet.id)}>
                    {bet.legs.map((leg) => {
                      const [home, away] = leg.fixtureLabel.split(" vs ");
                      const liveLine = formatLiveLine(fixtureStates.get(leg.fixtureId), now);
                      const outcome = legLiveResult(leg, fixtureStates.get(leg.fixtureId));
                      return (
                        <div key={`${leg.fixtureId}-${leg.marketId}`} className="flex gap-3 border-b border-border p-3 last:border-b-0">
                          <LegOutcomeIcon outcome={outcome ?? "pending"} size="sm" className="mt-0.5" />
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-1.5 text-[13px]">
                              <span className="font-bold text-foreground">{leg.selectionLabel} @ {leg.odds.toFixed(2)}</span>
                              <span className="text-[#999999] ml-1">{leg.marketLabel}</span>
                            </div>
                            <div className="text-[13px] text-foreground">
                              <span className="underline decoration-[#CCCCCC] underline-offset-2">{home}</span>
                              <span className="text-[#999999] mx-1">vs</span>
                              <span className="underline decoration-[#CCCCCC] underline-offset-2">{away}</span>
                            </div>
                            {/* Kickoff time only shows pre-match — once a match has
                                started this is replaced by the live clock/score line. */}
                            {liveLine ? (
                              <div className={cn("text-[11px] font-semibold", liveLine.isFinal ? "text-[#999999]" : "text-[#1B7C33]")}>
                                {liveLine.text}
                              </div>
                            ) : (
                              leg.kickoffAt && (
                                <div className="text-[11px] text-[#999999]">
                                  {new Date(leg.kickoffAt)
                                    .toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
                                    .replace(",", "")}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-3 py-2 flex justify-end">
                    <button onClick={() => toggleBet(bet.id)} className="flex items-center gap-1 text-[#1B7C33] text-[11px] font-semibold">
                      Hide Match Details <ChevronUp className="size-3.5" />
                    </button>
                  </div>

                  <div className="border-t border-border px-3 pb-3 pt-3">
                    <div className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">Stake</span>
                        <span className="font-bold text-foreground">{fmt(bet.stake)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">Pot. Win</span>
                        <span className="font-bold text-foreground">{fmt(bet.potentialPayout)}</span>
                      </div>
                      
                    </div>
                    <button
                      type="button"
                      disabled={!eligible}
                      onClick={() => eligible && setCashoutTarget(bet)}
                      className={cn("w-full rounded-[4px] py-2.5 text-center", eligible ? "bg-[#1F6BFF]" : "cursor-not-allowed bg-[#1F6BFF]/40")}
                    >
                      <div className="text-[13px] font-bold text-white">Cashout</div>
                      <div className="text-[13px] font-semibold text-white">{eligible ? `${balanceVisible ? `${CURRENCY} ` : ""}${fmt(bet.stake)}` : "Unavailable"}</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={cashoutTarget !== null} onOpenChange={(open) => !open && !cashingOut && setCashoutTarget(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle className="text-xl">Cash out this bet?</DialogTitle>
            <DialogDescription>
              You will get your {CURRENCY} {cashoutTarget && balanceVisible ? fmt(cashoutTarget.stake) : "••••••"} stake back and this bet will be settled immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button onClick={confirmCashout} disabled={cashingOut} className="w-full">
              {cashingOut ? "Cashing out…" : "Confirm Cashout"}
            </Button>
            <Button variant="outline" onClick={() => setCashoutTarget(null)} disabled={cashingOut} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
