"use client";

import Link from "next/link";
import { getSports } from "@/data/selectors";
import { SPORT_ICONS } from "@/lib/sport-icons";
import { useLiveFixtures } from "@/hooks/use-fixtures";
import { cn } from "@/lib/utils";

/** Quick-jump tiles for each sport, with a live-match count where there is one. */
export function SportTiles() {
  const sports = getSports();
  const { fixtures: live } = useLiveFixtures();

  return (
    // Vertical padding gives the hover lift room — this row scrolls sideways, and a
    // scroll container clips anything that rises above its top edge.
    <div className="-mx-2 mt-2 flex gap-2.5 overflow-x-auto px-2 pt-3 pb-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-8 lg:px-1">
      {sports.map((sport, i) => {
        const Icon = SPORT_ICONS[sport.slug];
        const liveCount = live.filter((f) => f.sportSlug === sport.slug).length;
        return (
          <Link
            key={sport.slug}
            href={`/sports?sport=${sport.slug}`}
            className={cn(
              "group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center transition-all duration-300 ease-out hover:z-10 hover:-translate-y-2 hover:scale-[1.06] active:scale-95 lg:w-auto",
              i === 0
                ? "border-navy bg-navy text-white shadow-sm shadow-navy/10 hover:shadow-lg hover:shadow-navy/15"
                : "border-border/60 bg-card text-foreground shadow-sm shadow-navy/10 hover:border-border hover:shadow-lg hover:shadow-navy/15"
            )}
          >
            {liveCount > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-live px-1.5 text-[9px] leading-4 font-bold text-white">
                {liveCount}
              </span>
            )}
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-all duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6",
                i === 0 ? "bg-volt text-navy" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="w-full truncate text-xs font-bold">{sport.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
