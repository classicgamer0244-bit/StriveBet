"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { groupFixturesByLeague } from "@/data/selectors";
import type { SportSlug } from "@/types";
import { useUpcomingFixtures } from "@/hooks/use-fixtures";
import { SportFilterPills } from "./sport-filter-pills";
import { CompetitionGroup } from "@/components/fixtures/competition-group";
import { EmptyState } from "@/components/common/empty-state";
import { FixtureListSkeleton } from "@/components/fixtures/fixture-list-skeleton";

export function ScheduleView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSport = (searchParams.get("sport") ?? "football") as SportSlug;

  function handleSelect(slug: SportSlug) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sport", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const { fixtures, hydrated } = useUpcomingFixtures(activeSport);
  const groups = groupFixturesByLeague(fixtures);

  return (
    <div className="flex flex-col gap-4 bg-navy p-4">
      <SportFilterPills activeSport={activeSport} onSelect={handleSelect} orientation="horizontal" mode="upcoming" />
      <div className="overflow-hidden rounded-lg border border-white/10">
        {!hydrated ? (
          <div className="bg-neutral-900">
            <FixtureListSkeleton dark />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-neutral-900">
            <EmptyState title="No scheduled fixtures" description="Nothing upcoming for this sport yet." />
          </div>
        ) : (
          groups.map((group) => (
            <CompetitionGroup key={group.leagueId} leagueName={group.leagueName} fixtures={group.fixtures} dark />
          ))
        )}
      </div>
    </div>
  );
}
