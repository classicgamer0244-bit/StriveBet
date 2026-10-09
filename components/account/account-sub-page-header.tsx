"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

const TITLES: Record<string, string> = {
  "/account/deposit": "Deposit",
  "/account/withdraw": "Withdraw",
  "/account/transactions": "Transactions",
  "/account/bet-history": "Bet History",
  "/account/daily-streak": "Daily Streak",
  "/account/gifts": "Gifts",
  "/account/notifications": "Notifications",
  "/account/settings": "Account Settings",
  "/account/security": "Safety & Security",
  "/account/loyalty": "Sporty Loyalty",
  "/account/support": "Customer Support",
};

export function AccountSubPageHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname];

  if (!title) return null;

  return (
    <div className="flex items-center justify-between bg-[#0B1230] px-4 py-3 sticky top-0 z-40 lg:hidden">
      <Link href="/account" aria-label="Go back" className="text-white">
        <ArrowLeft className="size-5" />
      </Link>
      <span className="text-base font-bold text-white">{title}</span>
      <Link href="/" aria-label="Home" className="text-white">
        <Home className="size-5" />
      </Link>
    </div>
  );
}
