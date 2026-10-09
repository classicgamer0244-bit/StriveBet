"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Link2,
  Store,
  Home,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/constants";
import { BRAND_NAME } from "@/lib/constants";
import { useCurrentAdmin } from "@/hooks/use-current-admin";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  Merchants: Store,
  Matches: Trophy,
  Users: Users,
  "My Users": Users,
  Deposits: ArrowDownToLine,
  Withdrawals: ArrowUpFromLine,
  Transactions: ArrowLeftRight,
  "Referral Link": Link2,
  Settings: Settings,
};

export function OperatorSidebar({ nav, kind }: { nav: NavItem[]; kind: "Admin" | "Superadmin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentAdmin } = useCurrentAdmin();
  const { logout: signOut } = useAuth();

  function isActive(href: string) {
    if (href === "/admin" || href === "/superadmin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function logout() {
    await signOut();
    router.push("/");
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-64">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-lg font-extrabold tracking-tight text-foreground">
          {BRAND_NAME}
          <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
            {kind}
          </span>
        </div>
        {currentAdmin && (
          <p className="mt-2 truncate text-sm text-muted-foreground">{currentAdmin.displayName}</p>
        )}
      </div>

      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-1">
        {nav.map((item) => {
          const Icon = ICONS[item.label] ?? LayoutDashboard;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap",
                "border lg:border-0",
                active
                  ? "border-primary bg-primary text-primary-foreground lg:bg-primary/15 lg:text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted lg:border-transparent lg:bg-transparent"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex gap-2">
        <Link
          href="/"
          className="flex flex-1 items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <Home className="size-4" />
          Home
        </Link>
        <button
          onClick={logout}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
