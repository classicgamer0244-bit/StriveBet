"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, Trophy, User, ReceiptText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOpenBets } from "@/hooks/use-open-bets";
import { useBetslip } from "@/hooks/use-betslip";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const { openBets } = useOpenBets();
  const { count, setMobileOpen } = useBetslip();
  const openCount = isLoggedIn ? openBets.length : 0;

  const isTicketDetails = pathname.startsWith("/account/bet-history/");

  if (isTicketDetails) return null;

  const itemClass = (active: boolean) =>
    cn(
      "relative flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-semibold transition-colors",
      active ? "text-volt" : "text-white/50"
    );
  const activeDot = <span className="absolute top-0 h-0.5 w-6 rounded-full bg-volt" />;

  const isHome = pathname === "/";
  const isSports = pathname.startsWith("/sports");
  const isMyBets = pathname === "/account/bet-history";
  const isMe = pathname.startsWith("/account") && !isMyBets;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-end rounded-t-2xl bg-navy px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(11,18,48,0.25)] lg:hidden"
      aria-label="Primary"
    >
      <Link href="/" aria-label="Home" className={itemClass(isHome)}>
        {isHome && activeDot}
        <Home className="size-5" />
        Home
      </Link>

      <Link href="/sports" className={itemClass(isSports)}>
        {isSports && activeDot}
        <Trophy className="size-5" />
        Sports
      </Link>

      {/* Centre betslip button — raised above the bar */}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={`Open betslip, ${count} selection${count === 1 ? "" : "s"}`}
          className="relative -mt-6 mb-1.5 flex flex-col items-center gap-1 text-[10px] font-semibold text-white/80"
        >
          <span className="flex size-14 items-center justify-center rounded-full border-4 border-background bg-volt text-navy shadow-lg">
            <ReceiptText className="size-6" />
          </span>
          {count > 0 && (
            <span className="absolute -top-1 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
          Betslip
        </button>
      </div>

      <Link href="/account/bet-history" className={itemClass(isMyBets)}>
        {isMyBets && activeDot}
        <span className="relative inline-flex">
          <Ticket className="size-5" />
          {openCount > 0 && (
            <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
              {openCount}
            </span>
          )}
        </span>
        My Bets
      </Link>

      <Link href="/account" className={itemClass(isMe)}>
        {isMe && activeDot}
        <span className="relative">
          <User className="size-5" />
          {isLoggedIn && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-volt" />}
        </span>
        Me
      </Link>
    </nav>
  );
}
