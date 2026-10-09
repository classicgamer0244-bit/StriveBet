"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { BetslipPanel } from "@/components/betslip/betslip-panel";
import { MiniGamesTeaser } from "@/components/home/mini-games-teaser";
import { GrandPrizeWinners } from "@/components/home/grand-prize-winners";

function InstantRegistrationCard() {
  const { openRegister } = useUI();
  const [phone, setPhone] = useState("");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-2 p-4 text-white">
      <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/30 blur-2xl" />
      <div className="relative">
        <span className="flex size-9 items-center justify-center rounded-xl bg-volt text-navy">
          <Gift className="size-4.5" />
        </span>
        <h3 className="mt-3 text-base leading-tight font-extrabold">Join StriveBet in seconds</h3>
        <p className="mt-1 text-xs text-white/55">Register with your mobile number and start betting.</p>
        <div className="mt-3 flex h-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <span className="flex items-center border-r border-white/10 px-3 text-xs font-bold text-volt">+233</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile Number"
            inputMode="numeric"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
        <Button onClick={openRegister} className="mt-2 h-10 w-full rounded-xl bg-volt font-extrabold text-navy hover:bg-volt/85">
          Create account
        </Button>
      </div>
    </div>
  );
}

export function RightRail() {
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden lg:block">
        <BetslipPanel />
      </div>
      {!isLoggedIn && (
        <div className="hidden lg:block">
          <InstantRegistrationCard />
        </div>
      )}
      {isHome && (
        <>
          <div className="hidden lg:block">
            <MiniGamesTeaser />
          </div>
          <GrandPrizeWinners />
        </>
      )}
    </div>
  );
}
