"use client";

import Link from "next/link";
import { Flame, Zap } from "lucide-react";
import type { Fixture } from "@/types";
import { OddsButton } from "@/components/odds/odds-button";
import { TeamCrest } from "@/components/fixtures/team-crest";
import { getMainMarket } from "@/lib/markets/main-market";

export function MobileFeaturedMatchCard({ fixture }: { fixture: Fixture }) {
  const fixtureLabel = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
  const oneXTwo = getMainMarket(fixture);
  const cheapestOdds = oneXTwo ? Math.min(...oneXTwo.selections.map((s) => s.odds)) : null;
  const time = new Date(fixture.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const score = fixture.score;

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm transition-shadow hover:shadow-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/[0.07] to-transparent" />
      <Link href={`/sports/${fixture.id}`} className="relative block">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold text-muted-foreground">{fixture.leagueName}</span>
          <div className="flex shrink-0 gap-1">
            <span className="flex items-center gap-0.5 rounded-full bg-live/10 px-2 py-0.5 text-[10px] font-extrabold text-live uppercase">
              <Flame className="size-3" />
              Hot
            </span>
            <span className="flex items-center gap-0.5 rounded-full bg-volt px-2 py-0.5 text-[10px] font-extrabold text-navy uppercase">
              <Zap className="size-3" />
              Boost
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="flex size-14 items-center justify-center">
              <TeamCrest team={fixture.homeTeam} containerClassName="size-12" imageSize={44} textClassName="text-xs" fallback="skeleton" />
            </span>
            <span className="w-full truncate text-center text-xs font-bold text-foreground">{fixture.homeTeam.name}</span>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 text-center">
            {isLive && score ? (
              <>
                <span className="text-2xl font-black text-foreground tabular-nums">{score.home}:{score.away}</span>
                <span className="flex items-center gap-1 rounded-full bg-live/10 px-2 py-0.5 text-[10px] font-bold text-live">
                  <span className="size-1.5 animate-pulse rounded-full bg-live" />
                  {fixture.minute ?? "Live"}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-foreground tabular-nums">{time}</span>
                <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white">Today</span>
              </>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="flex size-14 items-center justify-center">
              <TeamCrest team={fixture.awayTeam} containerClassName="size-12" imageSize={44} textClassName="text-xs" fallback="skeleton" />
            </span>
            <span className="w-full truncate text-center text-xs font-bold text-foreground">{fixture.awayTeam.name}</span>
          </div>
        </div>
      </Link>

      {oneXTwo && (
        <div className={`relative mt-4 grid gap-2 ${oneXTwo.selections.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {oneXTwo.selections.map((s) => (
            <OddsButton
              key={s.id}
              variant="stacked"
              fixtureId={fixture.id}
              fixtureLabel={fixtureLabel}
              marketId={oneXTwo.id}
              marketName={oneXTwo.name}
              selection={s}
              highlight={s.odds === cheapestOdds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
