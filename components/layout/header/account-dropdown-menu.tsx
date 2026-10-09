"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ACCOUNT_NAV } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { ScreenshotBalanceModal } from "@/components/admin/screenshot-balance-modal";

export function AccountDropdownMenu() {
  const { logout, admin, player } = useAuth();
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  const dashboardHref = admin ? (admin.role === "superadmin" ? "/superadmin" : "/admin") : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-white hover:bg-white/15 hover:text-white">
            My Account
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {dashboardHref && (
            <>
              <DropdownMenuItem asChild>
                <Link href={dashboardHref} className="font-semibold">
                  <LayoutDashboard className="size-4" />
                  Admin Dashboard
                </Link>
              </DropdownMenuItem>
              {admin?.role === "admin" && (
                <DropdownMenuItem
                  onClick={() => setScreenshotModalOpen(true)}
                  className="cursor-pointer font-bold text-volt focus:text-volt"
                >
                  <Camera className="size-4" />
                  Set Screenshot Balance
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
        {ACCOUNT_NAV.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} variant="destructive">
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {admin?.role === "admin" && (
      <ScreenshotBalanceModal
        open={screenshotModalOpen}
        onOpenChange={setScreenshotModalOpen}
        currentBalance={player?.balance ?? 0}
      />
    )}
  </>
  );
}
