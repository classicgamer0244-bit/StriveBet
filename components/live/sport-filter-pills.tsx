"use client";

import { getSports } from "@/data/selectors";
import { useLiveFixtures, useUpcomingFixtures } from "@/hooks/use-fixtures";
import { SPORT_ICONS } from "@/lib/sport-icons";
import { cn } from "@/lib/utils";
import type { SportSlug } from "@/types";

export function SportFilterPills({
  activeSport,
  onSelect,
  orientation = "horizontal",
  mode = "live",
}: {
  activeSport: SportSlug;
  onSelect: (slug: SportSlug) => void;
  orientation?: "horizontal" | "vertical";
  mode?: "live" | "upcoming";
}) {
  const sports = getSports();
  // Both hooks now just filter the single shared subscription in
  // context/live-feed-context.tsx (no network per call), so reading both
  // here no longer opens a duplicate connection the way it used to —
  // previously this alone opened a second /api/realtime/fixtures stream on
  // every page that already had one via single-view/multi-view.
  const { fixtures: live } = useLiveFixtures();
  const { fixtures: upcoming } = useUpcomingFixtures();
  const pool = mode === "live" ? live : upcoming;

  return (
    <div
      className={cn(
        "gap-2",
        orientation === "horizontal" ? "flex flex-wrap items-center" : "flex flex-col"
      )}
    >
      {sports.map((sport) => {
        const Icon = SPORT_ICONS[sport.slug];
        const count = pool.filter((f) => f.sportSlug === sport.slug).length;
        const isActive = activeSport === sport.slug;
        return (
          <button
            key={sport.slug}
            onClick={() => onSelect(sport.slug)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              orientation === "vertical" && "w-full justify-start",
              isActive ? "bg-primary text-white" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {sport.name}
            <span className={cn("text-xs", isActive ? "text-white/80" : "text-white/40")}>({count})</span>
          </button>
        );
      })}
    </div>
  );
}
