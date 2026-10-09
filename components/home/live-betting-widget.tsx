"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, RefreshCw } from "lucide-react";
import { getSports } from "@/data/selectors";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { cn } from "@/lib/utils";
import { LiveBettingList } from "@/components/fixtures/live-betting-list";
import { FixtureListSkeleton } from "@/components/fixtures/fixture-list-skeleton";

export function LiveBettingWidget() {
  const sports = getSports();
  const [activeSport, setActiveSport] = useState("football");
  // One fetch, not two: the per-tab list is just a client-side filter of the
  // same "all live" result, instead of a second independent request.
  const { fixtures: allLive, hydrated } = useLiveFixtures();
  const liveFixtures = allLive.filter((f) => f.sportSlug === activeSport).slice(0, 5);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Mobile Header + Tabs */}
      <div className="dark bg-background flex items-center gap-4 overflow-x-auto border-b border-border px-3 py-3 lg:hidden">
        <h2 className="text-xl font-extrabold text-foreground shrink-0">Live</h2>
        <span className="text-xl text-border shrink-0">|</span>
        {sports.map((sport) => (
          <button
            key={sport.slug}
            onClick={() => setActiveSport(sport.slug)}
            className={cn(
              "shrink-0 text-base font-bold whitespace-nowrap",
              activeSport === sport.slug ? "text-primary" : "text-muted-foreground"
            )}
          >
            {sport.name}
          </button>
        ))}
      </div>

      {/* Desktop Header */}
      <div className="hidden items-center justify-between border-b border-border px-4 py-3 lg:flex">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-live" />
          </span>
          Live Betting
          <span className="rounded-full bg-live/20 px-2 py-0.5 text-[11px] font-bold text-live">
            {allLive.length}
          </span>
        </h2>
        <div className="flex items-center gap-3 text-muted-foreground">
          <button aria-label="Print" className="transition-colors hover:text-foreground">
            <Printer className="size-4" />
          </button>
          <button aria-label="Refresh" className="transition-colors hover:text-foreground">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Desktop Sport tabs */}
      <div className="hidden gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:flex">
        {sports.map((sport) => (
          <button
            key={sport.slug}
            onClick={() => setActiveSport(sport.slug)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
              activeSport === sport.slug
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {sport.name}
          </button>
        ))}
      </div>

      {/* Fixture list */}
      <div className="dark bg-background text-foreground lg:hidden">
        {hydrated ? <LiveBettingList fixtures={liveFixtures} /> : <FixtureListSkeleton />}
      </div>
      <div className="hidden lg:block">
        {hydrated ? <LiveBettingList fixtures={liveFixtures} /> : <FixtureListSkeleton />}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 text-center">
        <Link
          href="/live-betting"
          className="text-sm font-semibold text-primary transition-colors hover:underline"
        >
          View All Live ({allLive.length})
        </Link>
      </div>
    </section>
  );
}
