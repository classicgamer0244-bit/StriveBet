"use client";

import Link from "next/link";
import { useFixtureById, useFixturesByLeague } from "@/hooks/use-fixtures";
import { getSports } from "@/data/selectors";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { FixtureDetailHeader } from "@/components/fixtures/fixture-detail-header";
import { MarketTabs } from "@/components/odds/market-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export function FixtureDetailClient({ fixtureId }: { fixtureId: string }) {
  const { fixture, hydrated } = useFixtureById(fixtureId);
  const { fixtures: siblingFixtures } = useFixturesByLeague(fixture?.leagueId ?? "");

  if (!fixture) {
    if (!hydrated) {
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start justify-center gap-3">
                <div className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="size-14 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1 px-2 pt-3">
                  <Skeleton className="h-4 w-6" />
                </div>
                <div className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="size-14 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">Fixture not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">This match may have finished or the link is incorrect.</p>
        <Link href="/sports" className="text-sm font-semibold text-primary hover:underline">
          Back to Sports
        </Link>
      </div>
    );
  }

  const sport = getSports().find((s) => s.slug === fixture.sportSlug);
  const fixtureLabel = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: sport?.name ?? "Sports", href: "/sports" },
          { label: fixture.leagueName, href: `/sports?league=${fixture.leagueId}` },
          { label: fixtureLabel },
        ]}
      />
      <FixtureDetailHeader fixture={fixture} siblingFixtures={siblingFixtures} />
      <div className="rounded-lg border border-border bg-card">
        <MarketTabs markets={fixture.markets} fixtureId={fixture.id} fixtureLabel={fixtureLabel} />
      </div>
    </div>
  );
}
