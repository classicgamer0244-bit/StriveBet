"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye, EyeOff, Wallet, Landmark, ChevronRight,
  FileText, RefreshCw, Gift, Flame, Bell,
  ShieldCheck, Settings, LogOut, HeadphonesIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/brand/logo";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MENU_ITEMS = [
  {
    section: "Activity",
    items: [
      { icon: FileText,  label: "Bet History",          href: "/account/bet-history" },
      { icon: RefreshCw, label: "Transactions",          href: "/account/transactions" },
      { icon: Flame,     label: "Daily Streak",          href: "/account/daily-streak" },
      { icon: Gift,      label: "Gifts",                 href: "/account/gifts",        badge: "0" },
      { icon: Bell,      label: "Notifications",         href: "/account/notifications", badge: "3" },
    ],
  },
  {
    section: "Account",
    items: [
      { icon: ShieldCheck,      label: "Safety & Security",  href: "/account/security" },
      { icon: Settings,         label: "Account Settings",   href: "/account/settings" },
      { icon: HeadphonesIcon,   label: "Customer Support",   href: "/account/support" },
    ],
  },
];

function MenuItem({
  icon: Icon,
  label,
  href,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-background text-foreground/40 group-hover:bg-[#1F6BFF]/10 group-hover:text-[#1F6BFF] transition-colors">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && badge !== "0" && (
          <span className="flex size-5 items-center justify-center rounded-full bg-[#1F6BFF] text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
        <ChevronRight className="size-4 text-foreground/20 group-hover:text-foreground/50 transition-colors" />
      </div>
    </Link>
  );
}

export function MobileAccountHub() {
  const { player, balanceVisible, toggleBalanceVisible, logout, refreshBalance } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const rawPhone = player?.phone ?? "";
  const maskedPhone = rawPhone.length >= 6
    ? rawPhone.slice(0, 2) + "*".repeat(rawPhone.length - 5) + rawPhone.slice(-3)
    : rawPhone;

  return (
    <PullToRefresh onRefresh={refreshBalance}>
    <div className="flex flex-col bg-background pb-6 lg:hidden">

      {/* Header */}
      <div className="relative overflow-hidden bg-navy px-4 pb-8 pt-6 -mx-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F6BFF]/20 via-transparent to-transparent pointer-events-none" />

        {/* User row */}
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#1F6BFF] overflow-hidden ring-2 ring-white">
              <Image src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=96&h=96&fit=crop&crop=face" alt="Profile" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {maskedPhone || player?.displayName}
              </p>
              <p className="text-xs text-white/50">Verified Member</p>
            </div>
          </div>
          <Link href="/account/security" className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
            <Settings className="size-5" />
          </Link>
        </div>

        {/* Balance card */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Total Balance</span>
            <button onClick={toggleBalanceVisible} className="text-white/40 hover:text-white transition-colors">
              {balanceVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-white">
            {balanceVisible ? `${player?.currency ?? "GHS"} ${(player?.balance ?? 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••••"}
          </p>
          <p className="mt-0.5 text-xs text-white/30">
            <LogoMark className="size-10 opacity-40" />
          </p>
        </div>
      </div>

      {/* Deposit / Withdraw */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <Link
          href="/account/deposit"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#1F6BFF] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#1453CC]"
        >
          <Wallet className="size-4" />
          Deposit
        </Link>
        <Link
          href="/account/withdraw"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
        >
          <Landmark className="size-4" />
          Withdraw
        </Link>
      </div>

      {/* Menu sections */}
      <div className="flex flex-col gap-3 px-3">
        {MENU_ITEMS.map((section) => (
          <div key={section.section} className="overflow-hidden rounded-xl border border-border bg-card">
            <p className="border-b border-[#EEF1F7] px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground/30">
              {section.section}
            </p>
            <div className="divide-y divide-white/5">
              {section.items.map((item) => (
                <MenuItem key={item.label} {...item} />
              ))}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground/40 transition-colors hover:border-[#1F6BFF]/40 hover:text-[#1F6BFF]"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will be logged out of your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#1F6BFF] hover:bg-[#1453CC] text-white" onClick={logout}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
