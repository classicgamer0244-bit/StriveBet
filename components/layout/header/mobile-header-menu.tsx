"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowDownToLine,
  Camera,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreVertical,
  ReceiptText,
  Sun,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function MobileHeaderMenu({
  dashboardHref,
  onOpenScreenshotModal,
}: {
  dashboardHref?: string | null;
  onOpenScreenshotModal: () => void;
}) {
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More options"
          className="size-8 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/15 hover:text-white"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border border-white/10 bg-navy p-1 text-white shadow-2xl">
        {/* Deposit Quick Action */}
        <DropdownMenuItem asChild>
          <Link
            href="/account/deposit"
            className="flex items-center gap-2 rounded-lg bg-volt px-3 py-2 text-xs font-extrabold text-navy hover:bg-volt/85 focus:bg-volt/85 focus:text-navy cursor-pointer"
          >
            <ArrowDownToLine className="size-4" />
            <span>Deposit</span>
          </Link>
        </DropdownMenuItem>

        {dashboardHref && (
          <DropdownMenuItem asChild>
            <Link
              href={dashboardHref}
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer"
            >
              <LayoutDashboard className="size-4 text-volt" />
              <span>Staff Dashboard</span>
            </Link>
          </DropdownMenuItem>
        )}

        {/* Set Screenshot Balance shortcut */}
        <DropdownMenuItem
          onClick={onOpenScreenshotModal}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-volt hover:bg-white/10 focus:bg-white/10 focus:text-volt cursor-pointer"
        >
          <Camera className="size-4" />
          <span>Set Screenshot Balance</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-white/10" />

        {/* Theme switcher */}
        <DropdownMenuItem
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer"
        >
          <span className="flex items-center gap-2">
            {isDark ? <Sun className="size-4 text-volt" /> : <Moon className="size-4 text-volt" />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </span>
          <span className="text-[10px] text-white/50">{isDark ? "Dark" : "Light"}</span>
        </DropdownMenuItem>

        {/* My Bets */}
        <DropdownMenuItem asChild>
          <Link
            href="/account/bet-history"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer"
          >
            <ReceiptText className="size-4 text-white/70" />
            <span>My Bets</span>
          </Link>
        </DropdownMenuItem>

        {/* Account Hub */}
        <DropdownMenuItem asChild>
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer"
          >
            <UserRound className="size-4 text-white/70" />
            <span>My Account</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-white/10" />

        {/* Log out */}
        <DropdownMenuItem
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/15 focus:bg-red-500/15 focus:text-red-400 cursor-pointer"
        >
          <LogOut className="size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
