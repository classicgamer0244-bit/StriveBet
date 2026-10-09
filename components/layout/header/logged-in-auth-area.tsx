"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LayoutDashboard, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AccountDropdownMenu } from "./account-dropdown-menu";

export function LoggedInAuthArea() {
  const { player, admin, balanceVisible, toggleBalanceVisible, refreshBalance } = useAuth();
  const [spinning, setSpinning] = useState(false);

  if (!player) return null;

  // Staff accounts (admin/superadmin) get a direct way into their dashboard.
  const dashboardHref = admin ? (admin.role === "superadmin" ? "/superadmin" : "/admin") : null;

  function handleRefresh() {
    setSpinning(true);
    refreshBalance();
    setTimeout(() => setSpinning(false), 500);
  }

  const balanceLabel = balanceVisible ? `${player.currency} ${player.balance.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••••";

  return (
    <div className="flex items-center gap-2 text-white">
      {/* Mobile: compact balance pill + Deposit button */}
      <div className="flex items-center gap-2 lg:hidden">
        {dashboardHref && (
          <Link
            href={dashboardHref}
            aria-label="Admin dashboard"
            className="flex size-8 items-center justify-center rounded-full bg-volt text-navy"
          >
            <LayoutDashboard className="size-4" />
          </Link>
        )}
        <div className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pr-2.5 pl-1">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary">
            <UserRound className="size-3.5" />
          </span>
          <span className="text-xs font-bold tabular-nums">{balanceLabel}</span>
          <button onClick={toggleBalanceVisible} aria-label="Toggle balance visibility" className="text-white/60 hover:text-white">
            {balanceVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
        </div>
        <Button asChild size="sm" className="h-8 rounded-full bg-volt px-3.5 font-extrabold text-navy hover:bg-volt/85">
          <Link href="/account/deposit">Deposit</Link>
        </Button>
      </div>

      {/* Desktop: balance pill + shortcuts + account dropdown */}
      <div className="hidden items-center gap-2 lg:flex">
        <div className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4">
          <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Balance</span>
          <span className="text-sm font-bold tabular-nums">{balanceLabel}</span>
          <button onClick={toggleBalanceVisible} aria-label="Toggle balance visibility" className="text-white/50 hover:text-white">
            {balanceVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
          <button onClick={handleRefresh} aria-label="Refresh balance" className="text-white/50 hover:text-white">
            <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
          </button>
        </div>

        {dashboardHref && (
          <Button asChild size="sm" className="h-9 gap-1.5 rounded-full bg-volt px-4 font-extrabold text-navy hover:bg-volt/85">
            <Link href={dashboardHref}>
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
        )}
        <Button asChild size="sm" className={cn("h-9 rounded-full px-4 font-extrabold", dashboardHref ? "bg-white/10 text-white hover:bg-white/20" : "bg-volt text-navy hover:bg-volt/85")}>
          <Link href="/account/deposit">Deposit</Link>
        </Button>
        <Button asChild size="sm" className="h-9 rounded-full bg-white/10 px-4 font-bold text-white hover:bg-white/20">
          <Link href="/account/bet-history">My Bets</Link>
        </Button>
        <AccountDropdownMenu />
      </div>
    </div>
  );
}
