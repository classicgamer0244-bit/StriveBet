"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { groupFixturesByLeague } from "@/data/selectors";
import type { SportSlug } from "@/types";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { SportFilterPills } from "./sport-filter-pills";
import { LiveMatchListItem } from "./live-match-list-item";
import { LiveBadge } from "@/components/fixtures/live-badge";
import { MarketTabs } from "@/components/odds/market-tabs";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function SingleView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSport = (searchParams.get("sport") ?? "football") as SportSlug;

  const { fixtures, hydrated } = useLiveFixtures(activeSport);
  const groups = useMemo(() => groupFixturesByLeague(fixtures), [fixtures]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFixture = fixtures.find((f) => f.id === selectedId) ?? fixtures[0] ?? null;

  function handleSportSelect(slug: SportSlug) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sport", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-4 bg-navy p-4 lg:flex-row">
      <div className="shrink-0 lg:w-52">
        <SportFilterPills activeSport={activeSport} onSelect={handleSportSelect} orientation="vertical" mode="live" />
      </div>

      <div className="min-h-96 shrink-0 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950 lg:w-80">
        {!hydrated ? (
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-white/10" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title="No live matches" description="Nothing live for this sport right now." />
        ) : (
          groups.map((group) => (
            <div key={group.leagueId}>
              <div className="bg-white/5 px-3 py-2 text-[11px] font-bold tracking-widest text-white/40 uppercase">
                {group.leagueName}
              </div>
              {group.fixtures.map((fixture) => (
                <LiveMatchListItem
                  key={fixture.id}
                  fixture={fixture}
                  isActive={selectedFixture?.id === fixture.id}
                  onClick={() => setSelectedId(fixture.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-card">
        {!hydrated ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : selectedFixture ? (
          <>
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{selectedFixture.leagueName}</span>
                <div className="flex items-center gap-2">
                  <LiveBadge />
                  <span className="font-bold tabular-nums text-live">
                    {selectedFixture.minute} {selectedFixture.period}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-foreground sm:text-base">
                  {selectedFixture.homeTeam.name}
                </span>
                <span className="shrink-0 rounded-md bg-muted px-3 py-1 text-lg font-extrabold tabular-nums text-foreground">
                  {selectedFixture.score ? `${selectedFixture.score.home} - ${selectedFixture.score.away}` : "vs"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground sm:text-base">
                  {selectedFixture.awayTeam.name}
                </span>
              </div>
            </div>
            <MarketTabs
              markets={selectedFixture.markets}
              fixtureId={selectedFixture.id}
              fixtureLabel={`${selectedFixture.homeTeam.name} vs ${selectedFixture.awayTeam.name}`}
            />
          </>
        ) : (
          <EmptyState title="No live matches" description="Nothing live for this sport right now." />
        )}
      </div>
    </div>
  );
}
