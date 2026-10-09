"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Home, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoggedInAuthArea } from "./logged-in-auth-area";
import { LoggedOutAuthArea } from "./logged-out-auth-area";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { useCurrentAdmin } from "@/hooks/use-current-admin";
import { Logo } from "@/components/brand/logo";
import { ThemeSwitch, ThemeToggleButton } from "@/components/layout/theme-toggle";
import { DEFAULT_COUNTRY_FLAG, PRIMARY_NAV } from "@/lib/constants";
import { getSports } from "@/data/selectors";
import { cn } from "@/lib/utils";

/** The selected sport's name for the mobile sports sub-bar. Own component so
 * useSearchParams() sits inside a Suspense boundary. */
function CurrentSportTitle() {
  const sport = useSearchParams().get("sport") ?? "football";
  const name = getSports().find((s) => s.slug === sport)?.name ?? "Football";
  return <span className="text-base font-bold text-white">{name}</span>;
}

function AuthAreaSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <div className="flex items-center gap-2 lg:hidden">
        <div className="h-8 w-24 rounded-full bg-white/15" />
        <div className="h-8 w-16 rounded-full bg-white/15" />
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <div className="h-9 w-32 rounded-full bg-white/15" />
        <div className="h-9 w-24 rounded-full bg-white/15" />
        <div className="h-9 w-20 rounded-full bg-white/15" />
        <div className="size-9 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

export function Header() {
  const { isLoggedIn, authLoading } = useAuth();
  const { mobileMenuOpen, setMobileMenuOpen, openSearch } = useUI();
  const { currentAdmin } = useCurrentAdmin();
  const pathname = usePathname();
  const isSports = pathname.startsWith("/sports");
  const isBetHistory = pathname === "/account/bet-history";
  const isTicketDetails = pathname.startsWith("/account/bet-history/");
  const isAccountPage = pathname.startsWith("/account");
  const isAccountMe = pathname === "/account";

  if (isTicketDetails) return null;

  const brandHref =
    currentAdmin?.role === "superadmin" ? "/superadmin" : currentAdmin?.role === "admin" ? "/admin" : "/";

  return (
    <>
      <header className={cn("sticky top-0 z-40 bg-navy", isAccountPage && !isAccountMe && "hidden lg:block")}>
        {/* Mobile sub-bar — sports page (with title) and account me page (no title) */}
        {(isSports || isAccountMe) && (
          <div className="flex items-center justify-between px-4 py-3 lg:hidden">
            <Link href="/" aria-label="Go back" className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white">
              <ArrowLeft className="size-4.5" />
            </Link>
            {isSports && (
              <Suspense fallback={<span className="text-base font-bold text-white">Sports</span>}>
                <CurrentSportTitle />
              </Suspense>
            )}
            <Link href="/" aria-label="Home" className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Home className="size-4.5" />
            </Link>
          </div>
        )}

        {/* Main top bar */}
        <div className={cn((isSports || isBetHistory || isAccountMe) && "hidden lg:block")}>
          <div className="flex h-16 items-center justify-between gap-3 px-3 lg:px-6">
            {/* Mobile: logo. Desktop: the sidebar carries the logo, so the bar starts with search. */}
            <Link href={brandHref} className="flex shrink-0 items-center lg:hidden">
              <Logo markClassName="size-8" className="max-[399px]:[&>span:last-child]:hidden" />
            </Link>

            <button
              type="button"
              onClick={openSearch}
              className="hidden h-10 w-full max-w-sm items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/45 transition-colors hover:border-white/20 hover:bg-white/10 lg:flex"
            >
              <Search className="size-4" />
              Search teams, leagues or matches
            </button>

            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 2xl:flex">
                <span className="text-[10px] font-bold text-volt">{DEFAULT_COUNTRY_FLAG}</span>
                Ghana
              </span>
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white lg:hidden"
              >
                <Search className="size-4" />
              </button>
              <ThemeToggleButton />
              {authLoading ? <AuthAreaSkeleton /> : isLoggedIn ? <LoggedInAuthArea /> : <LoggedOutAuthArea />}
            </div>
          </div>
        </div>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 border-none bg-navy p-0 text-white">
          <SheetHeader className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle>
                <Logo markClassName="size-8" />
              </SheetTitle>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="text-white/60">
                <X className="size-5" />
              </button>
            </div>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {PRIMARY_NAV.map((item) => {
              const isActive = item.enabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.label}
                  href={item.enabled ? item.href : "#"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    isActive ? "bg-volt text-navy" : "text-white/75 hover:bg-white/5"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 p-4">
            <p className="mb-2 text-[10px] font-bold tracking-widest text-white/35 uppercase">Appearance</p>
            <ThemeSwitch />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
