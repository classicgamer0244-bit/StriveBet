"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Flame, Gamepad2, Gift, Home, Radio, Trophy, Gem, BarChart3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo, LogoMark } from "@/components/brand/logo";
import { getSports } from "@/data/selectors";
import { SPORT_ICONS } from "@/lib/sport-icons";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { cn } from "@/lib/utils";

const MAIN_LINKS = [
  { label: "Home", href: "/", icon: Home, enabled: true },
  { label: "Sports", href: "/sports", icon: Trophy, enabled: true },
  { label: "Live", href: "/live-betting", icon: Radio, enabled: true },
  { label: "Games", href: "/games", icon: Gamepad2, enabled: true },
  { label: "Jackpot", href: "#", icon: Gem, enabled: false },
  { label: "Promotions", href: "#", icon: Gift, enabled: false },
  { label: "Results", href: "#", icon: BarChart3, enabled: false },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarSports({ compact }: { compact: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sports = getSports();
  const activeSport = pathname.startsWith("/sports") ? searchParams.get("sport") ?? "football" : null;

  return (
    <ul className="flex flex-col gap-0.5">
      {sports.map((sport) => {
        const Icon = SPORT_ICONS[sport.slug];
        const active = activeSport === sport.slug;
        return (
          <li key={sport.slug}>
            <Link
              href={`/sports?sport=${sport.slug}`}
              title={sport.name}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                compact && "justify-center px-0",
                active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("size-4.5 shrink-0", active && "text-volt")} />
              {!compact && <span className="truncate">{sport.name}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Desktop app-shell navigation. Full width (240px) on xl screens; collapses
 * to an icon rail on lg, and always on /sports where the page brings its own
 * league sidebar.
 */
export function AppSidebar({ compact }: { compact: boolean }) {
  const pathname = usePathname();
  const { fixtures: live } = useLiveFixtures();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 hidden flex-col bg-navy text-white lg:flex",
        compact ? "w-[72px]" : "w-[72px] xl:w-60"
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center", compact ? "justify-center" : "justify-center px-5 xl:justify-start")}>
        <Link href="/" aria-label="StiveBet home">
          {compact ? (
            <LogoMark className="size-9" />
          ) : (
            <>
              <LogoMark className="size-9 xl:hidden" />
              <Logo className="hidden xl:inline-flex" markClassName="size-9" />
            </>
          )}
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pt-2 pb-4 [scrollbar-width:none]">
        <nav className="flex flex-col gap-0.5">
          {MAIN_LINKS.map(({ label, href, icon: Icon, enabled }) => {
            const active = enabled && isActive(pathname, href);
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-volt text-navy" : "bg-white/5 text-white/70 group-hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className={cn("flex-1 truncate text-left", compact ? "hidden" : "hidden xl:block")}>{label}</span>
                {label === "Live" && live.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full bg-live px-1.5 py-px text-[10px] font-bold text-white",
                      compact ? "hidden" : "hidden xl:inline"
                    )}
                  >
                    {live.length}
                  </span>
                )}
                {!enabled && (
                  <span className={cn("text-[10px] font-semibold text-white/30 uppercase", compact ? "hidden" : "hidden xl:inline")}>
                    Soon
                  </span>
                )}
              </>
            );
            const cls = cn(
              "group flex items-center gap-3 rounded-xl p-1.5 text-sm font-semibold transition-colors",
              compact ? "justify-center" : "justify-center xl:justify-start",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
            );
            return enabled ? (
              <Link key={label} href={href} title={label} className={cls}>
                {content}
              </Link>
            ) : (
              <button key={label} type="button" title={label} onClick={() => toast.info(`${label} is coming soon.`)} className={cls}>
                {content}
              </button>
            );
          })}
        </nav>

        <div>
          <p className={cn("mb-2 px-3 text-[10px] font-bold tracking-widest text-white/35 uppercase", compact ? "hidden" : "hidden xl:block")}>
            Sports
          </p>
          <div className={cn("mx-auto mb-2 h-px w-8 bg-white/10", compact ? "block" : "xl:hidden")} />
          <Suspense fallback={null}>
            <SidebarSports compact={compact} />
          </Suspense>
        </div>

        {!compact && (
          <Link
            href="/account/daily-streak"
            className="relative mt-auto hidden overflow-hidden rounded-2xl bg-gradient-to-br from-[#1F6BFF] to-[#5A2DF0] p-4 xl:block"
          >
            <Flame className="absolute -right-3 -bottom-3 size-20 text-white/10" />
            <p className="text-[10px] font-bold tracking-widest text-volt uppercase">Daily Streak</p>
            <p className="mt-1 text-sm leading-snug font-bold">Bet every day and unlock bigger rewards</p>
            <span className="mt-3 inline-block rounded-full bg-volt px-3 py-1 text-xs font-extrabold text-navy">Claim now</span>
          </Link>
        )}
      </div>

      <div className={cn("flex shrink-0 items-center gap-2 border-t border-white/5 px-5 py-3 text-[11px] text-white/40", compact ? "justify-center px-0" : "justify-center xl:justify-start")}>
        <ShieldCheck className="size-4 shrink-0 text-volt" />
        <span className={compact ? "hidden" : "hidden xl:inline"}>18+ · Play responsibly</span>
      </div>
    </aside>
  );
}
