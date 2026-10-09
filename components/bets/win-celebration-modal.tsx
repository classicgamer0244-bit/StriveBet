"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useOpenBets } from "@/hooks/use-open-bets";
import { money } from "@/lib/format-money";
import confetti from "canvas-confetti";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { isOperatorPath } from "@/lib/layout/operator-path";
import { Logo } from "@/components/brand/logo";

const PREVIEW_MODE = false;

const MOCK: {
  id: string;
  status: "won" | "cashed_out";
  mode: "REAL" | "SIM";
  payout: number;
  verificationCode: string;
} = {
  id: "preview",
  status: "won",
  mode: "REAL",
  payout: 450.0,
  verificationCode: "A1B2C3D4",
};

/** Stable per-bet "you beat N% of users" figure, derived from the bet id rather
 * than Math.random(). Random-per-render meant the number could change under the
 * user mid-celebration (and is an impure call during render, which the React
 * compiler rejects outright); the same win now always shows the same figure. */
function winPercentFor(betId: string): number {
  let hash = 0;
  for (let i = 0; i < betId.length; i++) hash = (hash * 31 + betId.charCodeAt(i)) >>> 0;
  return 65 + (hash % 35);
}

export function WinCelebrationModal() {
  const { refreshBalance } = useAuth();
  const { pendingWins, clearAcknowledgedWins } = useOpenBets();
  const [copied, setCopied] = useState(false);
  const stopRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // Admins bet like anyone else (requirePlayerAccount serves them too), so they
  // do get real wins — but a full-screen confetti takeover on top of the
  // operator dashboard is wrong. Suppressed by nulling `current` rather than an
  // early return: the hooks below must keep running in the same order, and this
  // way the confetti loop and refreshBalance() don't fire either. The win is
  // deliberately NOT acknowledged, so it surfaces intact the moment they
  // navigate back to the player site.
  const suppressed = isOperatorPath(pathname);
  const current = suppressed ? null : PREVIEW_MODE ? MOCK : (pendingWins[0] ?? null);
  const currentId = current?.id;

  useEffect(() => {
    if (currentId) refreshBalance();
  }, [currentId, refreshBalance]);

  useEffect(() => {
    if (!current) return;
    stopRef.current = false;

    function frame() {
      if (stopRef.current) return;
      confetti({
        particleCount: 6,
        angle: 90,
        spread: 120,
        origin: { x: Math.random(), y: -0.1 },
        colors: ["#1F6BFF", "#ffffff", "#93B8FF", "#ffd700", "#ff6b6b"],
        gravity: 0.8,
        scalar: 0.9,
        ticks: 400,
      });
      setTimeout(frame, 50);
    }

    frame();
    return () => { stopRef.current = true; };
  }, [current?.id]);

  function acknowledge() {
    if (!current || PREVIEW_MODE) return;
    stopRef.current = true;
    setCopied(false);
    clearAcknowledgedWins([current.id]);
    fetch("/api/bets/wins/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betIds: [current.id] }),
    }).catch(() => {});
  }

  function handleDetails() {
    if (!current) return;
    const url = `/account/bet-history/${current.id}`;
    acknowledge();
    router.push(url);
  }

  async function handleShowOff() {
    if (!current) return;
    const cashedOut = current.status === "cashed_out";
    if (navigator.share) {
      try {
        await navigator.share({
          title: cashedOut ? "I just cashed out on StiveBet!" : "I just won on StiveBet!",
          text: cashedOut
            ? `I just cashed out ${money(current.payout ?? 0)} on StiveBet! Verify with code: ${current.verificationCode}`
            : `I just won ${money(current.payout ?? 0)}! Verify my win with code: ${current.verificationCode}`,
        });
      } catch (err) {
        // ignore
      }
    } else if (current.verificationCode) {
      try {
        await navigator.clipboard.writeText(current.verificationCode);
        setCopied(true);
        toast.success("Verification code copied!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Couldn't copy automatically.");
      }
    }
  }

  if (!current) return null;

  const isCashout = current.status === "cashed_out";
  // A SIM bet moves no real money in either direction. Celebrating one with the
  // same copy as a real win is what led a player to report being "credited only
  // my stake" after a GHS 31,710 win — their balance was correct all along; the
  // win was simulated and nothing said so.
  const isSim = current.mode === "SIM";

  return (
    <DialogPrimitive.Root open={true} onOpenChange={(next) => !next && acknowledge()}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6">
          
          {/* Top section: Close button */}
          <div className="w-full flex justify-end">
            <button
              onClick={acknowledge}
              className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col items-center justify-center flex-1 w-full gap-6 mt-4">
            <div className="flex flex-col items-center w-full">
              {!isCashout && (
                <p className="text-[#1F6BFF] font-semibold text-center max-w-[220px] mb-4 text-sm leading-snug">
                  You have won more<br/>than <span className="text-white">{winPercentFor(current.id)}%</span> of all users.
                </p>
              )}

              {/* A cashout returns exactly the stake — calling that "YOU WON"
                  is what made players report being paid their stake instead of
                  their winnings. Same modal, honest copy. */}
              {isSim && (
                <span className="mb-2 rounded-sm bg-[#8A5A00] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  SIM bet
                </span>
              )}

              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-wide mb-1">
                {isCashout ? "CASHED OUT" : "YOU WON"}
              </h2>

              <p className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                {money(current.payout ?? 0)}
              </p>

              <div className="relative w-full max-w-[220px] sm:max-w-[260px] aspect-square flex items-center justify-center pointer-events-none">
                <Image 
                  src="/winning-trophy.png" 
                  alt="Winning Trophy" 
                  fill 
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Verify Code and Buttons */}
            <div className="w-full flex flex-col items-center gap-5">
              {current.verificationCode && (
                <div className="flex items-center gap-2 text-white/80 text-sm sm:text-base">
                  <span>Verify Code:</span>
                  <span className="font-bold text-[#1F6BFF] tracking-wider">{current.verificationCode}</span>
                </div>
              )}
              
              <div className="flex w-full gap-4 max-w-sm px-2">
                 <Button 
                   onClick={handleDetails} 
                   variant="outline" 
                   className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white h-10 rounded-lg text-sm font-bold transition-colors"
                 >
                   Details
                 </Button>
                 <Button 
                   onClick={handleShowOff} 
                   className="flex-1 bg-[#1F6BFF] text-white hover:bg-[#1453CC] h-10 rounded-lg text-sm font-bold transition-colors"
                 >
                   {copied ? <Check className="size-4 mr-2" /> : null}
                   {copied ? "Copied!" : "Show Off"}
                 </Button>
              </div>

              <div className="mt-2 pointer-events-none">
                <Logo markClassName="size-7" />
              </div>
            </div>
          </div>
          
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
