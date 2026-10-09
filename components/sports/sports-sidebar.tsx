"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";
import { cn } from "@/lib/utils";
import { StartTimeFilterSlider, type StartTimeStep } from "./start-time-filter-slider";
import { LeagueList } from "./league-list";

const TABS = [
  { key: "today", label: "Today Games" },
  { key: "upcoming", label: "Upcoming Games" },
  { key: "outrights", label: "Outrights" },
] as const;

export function SportsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") ?? "today";
  const activeLeagueId = searchParams.get("league") ?? undefined;
  const startTime = (searchParams.get("start") as StartTimeStep) ?? "All";
  const sport = searchParams.get("sport") ?? "football";
  const { popular: allPopular, az: allAz } = useLeagues();
  // Only the selected sport's leagues.
  const popular = allPopular.filter((l) => l.sportSlug === sport);
  const az = allAz.filter((l) => l.sportSlug === sport);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/sports?${params.toString()}`, { scroll: false });
  }

  return (
    <aside className="hidden lg:flex w-full shrink-0 flex-col gap-4 lg:w-64">
      <div className="rounded-lg border border-border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => updateParam("tab", tab.key)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold",
              pathname === "/sports" && activeTab === tab.key
                ? "bg-primary-50 text-primary-700"
                : "text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <StartTimeFilterSlider value={startTime} onChange={(step) => updateParam("start", step)} />
      </div>

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4">
        <LeagueList title="Popular" leagues={popular} activeLeagueId={activeLeagueId} />
        <LeagueList title="A-Z" leagues={az} activeLeagueId={activeLeagueId} />
      </div>
    </aside>
  );
}
