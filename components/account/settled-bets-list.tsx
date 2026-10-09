"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBets } from "@/hooks/use-bets";
import { CURRENCY } from "@/lib/constants";
import { formatAmount } from "@/lib/format-money";
import { EmptyState } from "@/components/common/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PlacedBet } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  won: "Won",
  lost: "Lost",
  void: "Void",
  cashed_out: "Cashed Out",
};

export type SettledStatusFilter = "All" | "Settled" | "Unsettled";
export type SettledResultFilter = "All" | "Won" | "Lost" | "Void";

const REVEAL_WIDTH = 76;
const DRAG_CLICK_THRESHOLD = 6;

/** Swipe-left-to-reveal-delete, matching the common mobile list pattern.
 * Wraps the row rather than replacing its Link so a plain tap still
 * navigates normally — only a real drag (past DRAG_CLICK_THRESHOLD)
 * suppresses the click that would otherwise fire on pointer-up. */
function SwipeableRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startTranslate = useRef(0);
  const draggedFar = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    setDragging(true);
    draggedFar.current = false;
    startX.current = e.clientX;
    startTranslate.current = translateX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || e.pointerType === "mouse") return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > DRAG_CLICK_THRESHOLD) draggedFar.current = true;
    setTranslateX(Math.min(0, Math.max(-REVEAL_WIDTH, startTranslate.current + delta)));
  }
  function onPointerUp() {
    setDragging(false);
    setTranslateX((t) => (t < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0));
  }
  function onClickCapture(e: React.MouseEvent) {
    if (draggedFar.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => { setTranslateX(0); onDelete(); }}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-[#E53935] text-white"
        style={{ width: REVEAL_WIDTH }}
        aria-label="Delete bet"
      >
        <Trash2 className="size-5" />
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        style={{ transform: `translateX(${translateX}px)`, transition: dragging ? "none" : "transform 0.2s ease" }}
        className="touch-pan-y bg-muted/50"
      >
        {children}
      </div>
    </div>
  );
}

export function SettledBetsList({
  statusFilter = "All",
  resultFilter = "All",
}: {
  statusFilter?: SettledStatusFilter;
  resultFilter?: SettledResultFilter;
}) {
  const { bets, hydrated, refresh } = useBets("settled");
  const [deleteTarget, setDeleteTarget] = useState<PlacedBet | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!hydrated) return (
    <div className="flex items-center justify-center py-16">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-[#1F6BFF]" />
    </div>
  );

  const filteredBets = bets.filter((bet) => {
    // "Unsettled" here means cashed out early rather than resolved by the
    // match's actual result — every bet in this list has already left the
    // OPEN state, so this is the only distinction left to draw.
    if (statusFilter === "Settled" && bet.status === "cashed_out") return false;
    if (statusFilter === "Unsettled" && bet.status !== "cashed_out") return false;
    if (resultFilter === "Won" && bet.status !== "won") return false;
    if (resultFilter === "Lost" && bet.status !== "lost") return false;
    if (resultFilter === "Void" && bet.status !== "void") return false;
    return true;
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bets/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Couldn't delete this bet.");
        return;
      }
      refresh();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (filteredBets.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={bets.length === 0 ? "No settled bets yet" : "No bets match these filters"}
          description={bets.length === 0 ? "Once your open bets are settled, they'll show up here." : "Try a different Bet Status or Bet Result filter."}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-2 pb-[120px]">
        {filteredBets.map((bet) => {
          const isWon = bet.status === "won";
          const isSim = bet.mode === "SIM";
          const placed = new Date(bet.placedAt);
          const day = placed.toLocaleDateString(undefined, { day: "2-digit" });
          const month = placed.toLocaleDateString(undefined, { month: "short" });

          return (
            <div key={bet.id} className="flex gap-2">
              <div className="flex flex-col pt-1 text-center min-w-[24px]">
                <span className="text-[15px] font-bold text-foreground leading-none">{day}</span>
                <span className="text-[11px] text-[#999999]">{month}</span>
              </div>

              <div className="flex-1">
                <SwipeableRow onDelete={() => setDeleteTarget(bet)}>
                  <Link href={`/account/bet-history/${bet.id}`} className="block overflow-hidden bg-card border border-border">
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-1.5 text-white font-bold text-[13px]",
                        isWon ? "bg-[#1B7C33]" : "bg-[#999999]"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {bet.legs.length > 1 ? "Multiple" : "Single"}
                        {isSim && (
                          <span className="rounded-sm bg-white/25 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
                            SIM
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {isWon && <Trophy className="size-3.5" />}
                        {STATUS_LABEL[bet.status] ?? bet.status} &gt;
                      </span>
                    </div>
                    <div className="p-3">
                      {/* A SIM bet never touches the real balance — neither its
                          stake nor its return is real money. Without saying so
                          here it renders identically to a real bet, which is
                          exactly how a player came to report "I won GHS 31,710
                          but was only credited my stake": nothing was wrong with
                          their balance, the win was simulated. */}
                      {isSim && (
                        <p className="mb-2 rounded-sm bg-[#FFF4E5] px-2 py-1.5 text-[11px] leading-snug text-[#8A5A00]">
                          SIM bet — simulated only. No real money was staked or paid out.
                        </p>
                      )}
                      <div className="flex justify-between text-[13px] mb-1">
                        <span className="text-muted-foreground">Total Stake ({CURRENCY})</span>
                        <span className="font-bold text-foreground">{formatAmount(bet.stake)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] mb-3">
                        <span className="text-muted-foreground">Total Return</span>
                        <span className={cn("font-bold text-[15px]", isWon && !isSim ? "text-[#1B7C33]" : "text-foreground")}>
                          {formatAmount(bet.payout ?? 0)}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#999999] mb-1 leading-snug">
                        {bet.legs.slice(0, 3).map((leg) => (
                          <div key={`${leg.fixtureId}-${leg.marketId}`}>{leg.fixtureLabel.replace(" vs ", " v ")}</div>
                        ))}
                        {bet.legs.length > 3 && <div>...(and {bet.legs.length - 3} other matches)</div>}
                      </div>
                    </div>
                  </Link>
                </SwipeableRow>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle className="text-xl">Delete this bet?</DialogTitle>
            <DialogDescription>This only removes it from your history and it cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="w-full">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
