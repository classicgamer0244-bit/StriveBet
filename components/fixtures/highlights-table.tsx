"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Printer, RefreshCw } from "lucide-react";
import type { Fixture } from "@/types";
import { groupFixturesByLeague, getSports } from "@/data/selectors";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CompetitionGroup } from "./competition-group";
import { MobileFixtureList } from "./mobile-fixture-list";

export function HighlightsTable({ initialFixtures, hydrated = true }: { initialFixtures: Fixture[]; hydrated?: boolean }) {
  const sports = getSports();
  const [activeSport, setActiveSport] = useState("football");

  const fixtures = useMemo(() => {
    const now = Date.now();
    return initialFixtures
      .filter((f) => f.sportSlug === activeSport)
      .filter((f) => f.status !== "finished" && f.status !== "cancelled" && new Date(f.kickoffAt).getTime() >= now)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  }, [initialFixtures, activeSport]);

  const leagueNames = useMemo(() => Array.from(new Set(fixtures.map((f) => f.leagueName))), [fixtures]);
  const [activeLeague, setActiveLeague] = useState<string | null>(null);

  const filtered = activeLeague ? fixtures.filter((f) => f.leagueName === activeLeague) : fixtures;
  const groups = groupFixturesByLeague(filtered);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Mobile Header + Tabs */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-border px-3 py-3 lg:hidden">
        <h2 className="shrink-0 text-lg font-extrabold text-foreground">Matches</h2>
        {sports.map((sport) => (
          <button
            key={sport.slug}
            onClick={() => {
              setActiveSport(sport.slug);
              setActiveLeague(null);
            }}
            className={cn(
              "shrink-0 text-sm font-bold whitespace-nowrap",
              activeSport === sport.slug ? "rounded-full bg-navy px-3 py-1 text-white" : "px-1 text-muted-foreground"
            )}
          >
            {sport.name}
          </button>
        ))}
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
        <button className="shrink-0 border-b-2 border-primary px-1 pb-1 text-sm font-bold text-foreground">
          Highlights
        </button>
        <button className="shrink-0 border-b-2 border-transparent px-1 pb-1 text-sm font-semibold text-muted-foreground">
          Today
        </button>
        <button className="shrink-0 border-b-2 border-transparent px-1 pb-1 text-sm font-semibold text-muted-foreground">
          Countries
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden items-center justify-between border-b border-border px-4 py-3 lg:flex">
        <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-foreground">
          <span className="flex size-8 items-center justify-center rounded-xl bg-navy text-volt">
            <CalendarDays className="size-4" />
          </span>
          Upcoming matches
        </h2>
        <div className="flex items-center gap-3 text-muted-foreground">
          <button aria-label="Print" className="hover:text-foreground">
            <Printer className="size-4" />
          </button>
          <button aria-label="Refresh" className="hover:text-foreground">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      <div className="hidden gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 lg:flex">
        {sports.map((sport) => (
          <button
            key={sport.slug}
            onClick={() => {
              setActiveSport(sport.slug);
              setActiveLeague(null);
            }}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              activeSport === sport.slug ? "bg-navy text-white" : "text-foreground/65 hover:bg-muted hover:text-foreground"
            )}
          >
            {sport.name}
          </button>
        ))}
      </div>

      <div className="hidden gap-2 overflow-x-auto border-b border-border px-4 py-2.5 lg:flex">
        {leagueNames.map((name) => (
          <button
            key={name}
            onClick={() => setActiveLeague((prev) => (prev === name ? null : name))}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              activeLeague === name
                ? "border-navy bg-navy text-white"
                : "border-border bg-card text-foreground/70 hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        {!hydrated
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <Skeleton className="h-4 w-10 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex w-52 shrink-0 gap-1.5">
                  <Skeleton className="h-8 flex-1 rounded" />
                  <Skeleton className="h-8 flex-1 rounded" />
                  <Skeleton className="h-8 flex-1 rounded" />
                </div>
                <Skeleton className="h-4 w-8 shrink-0" />
              </div>
            ))
          : groups.map((group) => (
              <CompetitionGroup
                key={group.leagueId}
                leagueName={group.leagueName}
                fixtures={group.fixtures}
                showGoalsColumn
                groupByDate
              />
            ))}
      </div>
      <div className="lg:hidden">
        {!hydrated
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-3 py-3 last:border-b-0">
                <Skeleton className="h-3 w-10 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Skeleton className="h-8 w-16 rounded" />
                  <Skeleton className="h-8 w-16 rounded" />
                  <Skeleton className="h-8 w-16 rounded" />
                </div>
              </div>
            ))
          : <MobileFixtureList fixtures={filtered} />}
      </div>

      {hydrated && filtered.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No upcoming {sports.find((s) => s.slug === activeSport)?.name ?? ""} matches right now — check back soon.
        </p>
      )}

      <div className="border-t border-border p-3">
        <Link href={`/sports?sport=${activeSport}`} className="block rounded-xl bg-muted/70 py-2.5 text-center text-sm font-bold text-foreground transition-colors hover:bg-navy hover:text-white">
          View all matches
        </Link>
      </div>
    </section>
  );
}
