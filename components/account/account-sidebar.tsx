"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Trophy,
  Flame,
  Wallet,
  Banknote,
  History,
  ArrowLeftRight,
  Bell,
  Gift,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { ACCOUNT_NAV } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserCard } from "./user-card";

const ICONS: Record<string, LucideIcon> = {
  "My Account Info": User,
  "Strive Loyalty": Trophy,
  "Daily Streak": Flame,
  Deposit: Wallet,
  Withdraw: Banknote,
  "Bet History": History,
  Transactions: ArrowLeftRight,
  "Notification Center": Bell,
  Gifts: Gift,
  "Safety & Security": ShieldCheck,
};

export function AccountSidebar() {
  const pathname = usePathname();
  const isAccountHome = pathname === "/account";

  return (
    <aside className="hidden w-full shrink-0 flex-col gap-3 lg:flex lg:w-64">
      <div className={cn(isAccountHome && "hidden lg:block")}>
        <UserCard />
      </div>

      {/* Desktop: vertical nav list */}
      <nav className="hidden flex-col gap-0.5 rounded-lg border border-border bg-card p-1 lg:flex">
        {ACCOUNT_NAV.map((item) => {
          const Icon = ICONS[item.label] ?? User;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                isActive ? "bg-[#1F6BFF]/10 text-[#1F6BFF]" : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.label === "Deposit" && <Badge className="h-5 rounded-full px-1.5 text-[10px]">Free</Badge>}
              {item.label === "Daily Streak" && (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                  0
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: horizontal chip nav (hidden on the account home page — the mobile hub replaces it) */}
      <nav className={cn("flex gap-2 overflow-x-auto lg:hidden", isAccountHome && "hidden")}>
        {ACCOUNT_NAV.map((item) => {
          const Icon = ICONS[item.label] ?? User;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                isActive ? "border-[#1F6BFF] bg-[#1F6BFF] text-white" : "border-border bg-card text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
