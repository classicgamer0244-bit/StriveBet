"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Headphones, Home, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/constants";
import { formatAmount } from "@/lib/format-money";
import { useBetById } from "@/hooks/use-bets";
import { Skeleton } from "@/components/ui/skeleton";
import { LegOutcomeIcon, type LegOutcome } from "@/components/bets/leg-outcome-icon";
import { describeMarketOutcome } from "@/lib/settlement/describe-outcome";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** "07/27, 15:00" — MM/DD, 24h time. */
function formatGameDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  const timePart = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart}, ${timePart}`;
}

export default function TicketDetailsPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const router = useRouter();
  const { bet, hydrated } = useBetById(ticketId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteTicket() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/bets/${ticketId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Couldn't delete this ticket.");
        return;
      }
      router.push("/account/bet-history?tab=settled");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 p-4 lg:mx-auto lg:max-w-2xl">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/50 px-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">Ticket not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">This bet may not exist or belongs to a different account.</p>
        <Link href="/account/bet-history" className="text-sm font-semibold text-primary hover:underline">
          Back to Bet History
        </Link>
      </div>
    );
  }

  const isWon = bet.status === "won";
  const isVoid = bet.status === "void";
  const verifyCode = bet.verificationCode ?? bet.id.slice(-8).toUpperCase();
  const shortBetId = bet.id.slice(-8).toUpperCase();
  const placed = new Date(bet.placedAt);
  const statusLabel = bet.status === "cashed_out" ? "Cashed Out" : bet.status;

  return (
    <div className="flex flex-col bg-muted/50 pb-4">
      {/* Mobile sticky header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-primary px-3 py-3 text-primary-foreground lg:hidden">
        <button
          onClick={() => router.push("/account/bet-history?tab=settled")}
          className="flex items-center gap-1 text-[15px] font-medium hover:opacity-90"
        >
          <ChevronLeft className="size-6" /> Back
        </button>
        <h1 className="text-[17px] font-bold">Ticket Details</h1>
        <div className="flex items-center gap-3">
          <button className="hover:opacity-80" aria-label="Support"><Headphones className="size-5" /></button>
          <Link href="/" className="hover:opacity-80"><Home className="size-5" /></Link>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden items-center justify-between border-b border-border bg-card px-6 py-4 lg:flex">
        <button
          onClick={() => router.push("/account/bet-history?tab=settled")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to Bet History
        </button>
        <h1 className="text-xl font-extrabold">Ticket Details</h1>
        <div className="flex items-center gap-3 text-muted-foreground">
          <button className="hover:text-foreground" aria-label="Support"><Headphones className="size-5" /></button>
          <Link href="/" className="hover:text-foreground"><Home className="size-5" /></Link>
        </div>
      </div>

      <div className="lg:mt-4 lg:overflow-hidden lg:rounded-xl lg:shadow-lg">
        <div className="bg-[#1D1F27] text-white">
          <div className="flex items-center justify-between border-b border-[#2C2E3B] px-4 py-2.5 text-[12px] text-[#8E92A4]">
            <span>Ticket ID: {shortBetId}</span>
            <span>{placed.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          </div>

          <div className="px-4 py-4 border-b border-[#2C2E3B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-[16px] text-white">{bet.legs.length > 1 ? "Multiple" : "Single"}</span>
              <span
                className={cn(
                  "flex items-center gap-1.5 font-extrabold text-[15px] capitalize",
                  isWon ? "text-[#00E676]" : isVoid ? "text-[#8E92A4]" : "text-[#8E92A4]"
                )}
              >
                {isWon && <Trophy className="size-4 fill-[#00E676] text-[#00E676]" />} {statusLabel}
              </span>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] text-[#A0A4B8]">{bet.status === "open" ? "Potential Return" : "Total Return"}</span>
              <span className={cn("font-extrabold text-[18px]", isWon ? "text-[#00E676]" : "text-white")}>
                {formatAmount(bet.status === "open" ? bet.potentialPayout : (bet.payout ?? 0))}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 text-[13px] text-[#A0A4B8]">
              <div className="flex justify-between">
                <span>Total Stake</span>
                <span className="text-white font-semibold">{CURRENCY} {formatAmount(bet.stake)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Odds</span>
                <span className="text-white font-semibold">{formatAmount(bet.totalOdds)}</span>
              </div>
            </div>

          </div>

          {bet.status !== "lost" && (
            <div className="bg-[#262833] px-4 py-2 text-center text-[12px] text-[#8E92A4]">
              Verify Code: <span className="font-mono text-[#00E676] font-semibold">{verifyCode}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col bg-card">
          {bet.legs.map((leg) => {
            const [home, away] = leg.fixtureLabel.split(" vs ");
            // Cashed-out bets never got a real result on any leg — they're
            // no longer tracked for live updates, so every leg shows the
            // same neutral clock a not-yet-started game would.
            const outcome: LegOutcome = bet.status === "cashed_out" ? "not-started" : (leg.result ?? "pending");
            const ftScore = leg.finalScore ? `${leg.finalScore.home}:${leg.finalScore.away}` : undefined;
            const outcomeLabel = leg.finalScore ? describeMarketOutcome(leg.marketName, leg.finalScore) : undefined;

            return (
              <div key={`${leg.fixtureId}-${leg.marketId}`} className="flex gap-3 border-b border-border p-4 last:border-b-0">
                <div className="pt-7">
                  <LegOutcomeIcon outcome={outcome} size="md" />
                </div>

                <div className="flex flex-1 flex-col">
                  <div className="text-[14px] font-semibold text-foreground mb-1">
                    {home} <span className="text-[#999999] font-normal">v</span> {away}
                  </div>
                  {leg.gameId && leg.kickoffAt && (
                    <div className="text-[11px] text-[#999999] mb-2">
                      Game ID: {leg.gameId} | {formatGameDateTime(leg.kickoffAt)}
                    </div>
                  )}

                  <div
                    className={cn(
                      "relative rounded-[4px] p-3 text-[12px] overflow-hidden",
                      leg.result === "won" ? "bg-[#EBF7EE] border border-[#C8E6C9]" : "bg-muted/50 border border-border"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#888888]">Pick</span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        {leg.selectionLabel}@{formatAmount(leg.odds)}
                        {leg.result === "won" && <span className="text-[#00E676] font-bold">✓</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#888888]">Market</span>
                      <span className="text-foreground font-medium">{leg.marketLabel}</span>
                    </div>
                    {ftScore && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[#888888]">FT Score</span>
                        <span className="text-foreground font-medium">{ftScore}</span>
                      </div>
                    )}
                    {outcomeLabel && (
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-[#888888]">Outcome</span>
                        <span className="text-foreground font-medium">{outcomeLabel}</span>
                      </div>
                    )}
                    {leg.result === "won" && (
                      <Trophy className="absolute right-2 top-1/2 -translate-y-1/2 size-16 text-[#00A859] opacity-10 pointer-events-none" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 text-center lg:mx-auto lg:max-w-2xl">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="text-[13px] font-semibold text-[#E53935] hover:underline"
        >
          Delete Ticket
        </button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(open) => !open && !deleting && setConfirmDelete(false)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle className="text-xl">Delete this ticket?</DialogTitle>
            <DialogDescription>This can&rsquo;t be undone. You&rsquo;ll be returned to your Bet History.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button variant="destructive" onClick={handleDeleteTicket} disabled={deleting} className="w-full">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
