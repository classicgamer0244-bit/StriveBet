"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SportSlug } from "@/types";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { SportFilterPills } from "./sport-filter-pills";
import { LiveBettingList } from "@/components/fixtures/live-betting-list";
import { FixtureListSkeleton } from "@/components/fixtures/fixture-list-skeleton";

export function MultiView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSport = (searchParams.get("sport") ?? "football") as SportSlug;

  function handleSelect(slug: SportSlug) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sport", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const { fixtures, hydrated } = useLiveFixtures(activeSport);

  return (
    <div className="flex flex-col gap-4 bg-navy p-4">
      <SportFilterPills activeSport={activeSport} onSelect={handleSelect} orientation="horizontal" mode="live" />
      <div className="overflow-hidden rounded-lg border border-white/10">
        {hydrated ? <LiveBettingList fixtures={fixtures} dark /> : <FixtureListSkeleton dark />}
      </div>
    </div>
  );
}
