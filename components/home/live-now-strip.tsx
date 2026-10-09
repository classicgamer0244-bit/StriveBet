"use client";

import { useState } from "react";
import Link from "next/link";
import type { Fixture } from "@/types";
import { getSports } from "@/data/selectors";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { OddsButton } from "@/components/odds/odds-button";
import { TeamCrest } from "@/components/fixtures/team-crest";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "./section-header";
import { cn } from "@/lib/utils";
import { getMainMarket } from "@/lib/markets/main-market";

function LiveMatchCard({ fixture }: { fixture: Fixture }) {
  const fixtureLabel = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
  const oneXTwo = getMainMarket(fixture);
  const score = fixture.score;

  return (
    <div className="relative flex w-[290px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-navy-2 to-[#1B2A6B] p-4 text-white shadow-lg shadow-navy/15">
      <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-primary/25 blur-2xl" />

      <Link href={`/sports/${fixture.id}`} className="relative block">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium text-white/50">{fixture.leagueName}</span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[10px] font-bold text-live">
            <span className="size-1.5 animate-pulse rounded-full bg-live" />
            {fixture.minute ?? "LIVE"}
            {fixture.period && <span className="text-white/60">· {fixture.period}</span>}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { team: fixture.homeTeam, goals: score?.home },
            { team: fixture.awayTeam, goals: score?.away },
          ].map(({ team, goals }) => (
            <div key={team.name} className="flex items-center gap-2.5">
              <TeamCrest team={team} containerClassName="size-7" imageSize={24} textClassName="text-[9px] text-white/70" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{team.name}</span>
              <span className="w-6 text-right text-lg font-extrabold text-volt tabular-nums">{goals ?? "-"}</span>
            </div>
          ))}
        </div>
      </Link>

      {oneXTwo && (
        <div className={cn("relative mt-4 grid gap-1.5", oneXTwo.selections.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {oneXTwo.selections.map((s) => (
            <OddsButton
              key={s.id}
              variant="stacked"
              dark
              fixtureId={fixture.id}
              fixtureLabel={fixtureLabel}
              marketId={oneXTwo.id}
              marketName={oneXTwo.name}
              selection={s}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveNowStrip() {
  const sports = getSports();
  const { fixtures: allLive, hydrated } = useLiveFixtures();
  const [activeSport, setActiveSport] = useState<string>("all");

  const sportsWithLive = sports.filter((s) => allLive.some((f) => f.sportSlug === s.slug));
  const live = (activeSport === "all" ? allLive : allLive.filter((f) => f.sportSlug === activeSport)).slice(0, 12);

  if (hydrated && allLive.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Live now"
        live
        href="/live-betting"
        actionLabel={`All live (${allLive.length})`}
      />

      {sportsWithLive.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {[{ slug: "all", name: "All" }, ...sportsWithLive].map((s) => (
            <button
              key={s.slug}
              onClick={() => setActiveSport(s.slug)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                activeSport === s.slug ? "bg-navy text-white" : "bg-card text-foreground/70 ring-1 ring-border hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:thin]">
        {!hydrated
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[196px] w-[290px] shrink-0 rounded-2xl" />)
          : live.map((f) => <LiveMatchCard key={f.id} fixture={f} />)}
      </div>
    </section>
  );
}
