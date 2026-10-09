"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import type { Fixture } from "@/types";
import { MobileFixtureRow } from "@/components/fixtures/mobile-fixture-row";
import { type MarketViewKey } from "@/components/fixtures/mobile-market-view-tabs";
import { isRealFixtureId } from "@/lib/fixture-id";
import { cn } from "@/lib/utils";
import { getMainMarket } from "@/lib/markets/main-market";
import { PullToRefresh } from "@/components/common/pull-to-refresh";

const TIME_OPTIONS = [
  { label: "Next 3h", hours: 3 },
  { label: "Next 6h", hours: 6 },
  { label: "Today", hours: 24 },
  { label: "Tomorrow", hours: 48 },
  { label: "All", hours: null },
] as const;

const ODDS_OPTIONS = [
  { label: "All Odds", min: null, max: null },
  { label: "Low (<2)", min: null, max: 2 },
  { label: "Medium (2–3)", min: 2, max: 3 },
  { label: "High (>3)", min: 3, max: null },
] as const;

const SORT_OPTIONS = [
  { label: "By Time", value: "time" },
  { label: "By League", value: "league" },
] as const;

const MARKET_VIEWS: { label: string; value: MarketViewKey }[] = [
  { label: "1X2", value: "1x2" },
  { label: "O/U", value: "ou" },
  { label: "DC", value: "dc" },
  { label: "1st Half", value: "1st-half" },
  { label: "Handicap", value: "handicap" },
];

type DropdownKey = "time" | "league" | "odds" | "sort" | null;

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}
    >
      {label} <ChevronDown className={cn("size-3 transition-transform", active && "rotate-180")} />
    </button>
  );
}

function OptionRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold",
        active ? "text-primary" : "text-foreground hover:bg-muted"
      )}
    >
      {label}
      {active && <Check className="size-4 text-primary" />}
    </button>
  );
}

export function MobileAzMenuLayout({ fixtures }: { fixtures: Fixture[] }) {
  const [mainTab, setMainTab] = useState<"matches" | "upcoming">("matches");
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [timeFilter, setTimeFilter] = useState<number | null>(null);
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [oddsFilter, setOddsFilter] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [sort, setSort] = useState<"time" | "league">("time");
  const [marketView, setMarketView] = useState<MarketViewKey>("1x2");
  // Captured once on mount rather than read fresh inside the memo below —
  // Date.now() is impure and calling it directly during render/memoization
  // isn't allowed (react-hooks/purity).
  const [now] = useState(() => Date.now());

  const leagues = useMemo(
    () => Array.from(new Set(fixtures.map((f) => f.leagueName))).sort(),
    [fixtures]
  );

  const adminUpcoming = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return fixtures
      .filter((f) => !isRealFixtureId(f.id) && f.status === "upcoming" && new Date(f.kickoffAt) >= startOfToday && new Date(f.kickoffAt) <= endOfToday)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  }, [fixtures]);

  const filtered = useMemo(() => {
    if (mainTab === "upcoming") return adminUpcoming;
    let list = fixtures.filter((f) => f.status !== "live");

    if (timeFilter !== null) {
      const cutoff = now + timeFilter * 60 * 60 * 1000;
      list = list.filter((f) => new Date(f.kickoffAt).getTime() <= cutoff);
    }

    if (leagueFilter) {
      list = list.filter((f) => f.leagueName === leagueFilter);
    }

    if (oddsFilter.min !== null || oddsFilter.max !== null) {
      list = list.filter((f) => {
        const market = getMainMarket(f);
        if (!market) return false;
        const minOdds = Math.min(...market.selections.map((s) => s.odds));
        if (oddsFilter.min !== null && minOdds < oddsFilter.min) return false;
        if (oddsFilter.max !== null && minOdds >= oddsFilter.max) return false;
        return true;
      });
    }

    if (sort === "time") {
      list = [...list].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
    } else {
      list = [...list].sort((a, b) => a.leagueName.localeCompare(b.leagueName));
    }

    return list;
  }, [fixtures, mainTab, adminUpcoming, timeFilter, leagueFilter, oddsFilter, sort, now]);

  function toggle(key: DropdownKey) {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  const timeLabel = TIME_OPTIONS.find((o) => o.hours === timeFilter)?.label ?? "Time";
  const leagueLabel = leagueFilter ?? "League";
  const oddsLabel = ODDS_OPTIONS.find((o) => o.min === oddsFilter.min && o.max === oddsFilter.max)?.label ?? "Odds";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";

  return (
    <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      {/* All Live Block */}
      <Link href="/live-betting" className="flex items-center justify-between border-b border-border bg-card px-4 py-3 transition-colors active:bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">All Live</span>
          <span className="rounded bg-success px-1.5 py-0.5 text-xs font-bold text-white">
            {fixtures.filter((f) => f.status === "live" || f.status === "halftime").length}
          </span>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Matches / Upcoming Tabs */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setMainTab("matches")}
          className={cn("flex-1 border-b-2 py-3 text-center text-sm font-bold", mainTab === "matches" ? "border-primary text-foreground" : "border-transparent text-muted-foreground")}
        >Matches</button>
        <button
          onClick={() => setMainTab("upcoming")}
          className={cn("flex-1 border-b-2 py-3 text-center text-sm font-bold", mainTab === "upcoming" ? "border-primary text-foreground" : "border-transparent text-muted-foreground")}
        >Upcoming</button>
      </div>

      {/* Filters Row */}
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <FilterButton label={timeLabel} active={openDropdown === "time"} onClick={() => toggle("time")} />
          <FilterButton label={leagueLabel} active={openDropdown === "league"} onClick={() => toggle("league")} />
          <FilterButton label={oddsLabel} active={openDropdown === "odds"} onClick={() => toggle("odds")} />
          <FilterButton label={sortLabel} active={openDropdown === "sort"} onClick={() => toggle("sort")} />
        </div>

        {/* Open filter's options render in normal document flow below the row
            — never `absolute` inside the scroll container above, which would
            get clipped (overflow-x-auto forces overflow-y to clip too). */}
        {openDropdown && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-sm">
            {openDropdown === "time" &&
              TIME_OPTIONS.map((o) => (
                <OptionRow
                  key={o.label}
                  label={o.label}
                  active={timeFilter === o.hours}
                  onClick={() => {
                    setTimeFilter(o.hours);
                    setOpenDropdown(null);
                  }}
                />
              ))}
            {openDropdown === "league" && (
              <>
                <OptionRow
                  label="All Leagues"
                  active={leagueFilter === null}
                  onClick={() => {
                    setLeagueFilter(null);
                    setOpenDropdown(null);
                  }}
                />
                {leagues.map((name) => (
                  <OptionRow
                    key={name}
                    label={name}
                    active={leagueFilter === name}
                    onClick={() => {
                      setLeagueFilter(name);
                      setOpenDropdown(null);
                    }}
                  />
                ))}
              </>
            )}
            {openDropdown === "odds" &&
              ODDS_OPTIONS.map((o) => (
                <OptionRow
                  key={o.label}
                  label={o.label}
                  active={oddsFilter.min === o.min && oddsFilter.max === o.max}
                  onClick={() => {
                    setOddsFilter({ min: o.min, max: o.max });
                    setOpenDropdown(null);
                  }}
                />
              ))}
            {openDropdown === "sort" &&
              SORT_OPTIONS.map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  active={sort === o.value}
                  onClick={() => {
                    setSort(o.value);
                    setOpenDropdown(null);
                  }}
                />
              ))}
          </div>
        )}
      </div>

      {/* Market View Tabs */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex gap-4 overflow-x-auto text-xs font-bold text-muted-foreground [&::-webkit-scrollbar]:hidden">
          {MARKET_VIEWS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMarketView(m.value)}
              className={cn("shrink-0 whitespace-nowrap pb-1", marketView === m.value ? "border-b-2 border-success text-foreground" : "")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fixtures List */}
      <div className="flex flex-col pb-[120px]">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matches found for the selected filters.</p>
        ) : (
          filtered.map((fixture) => (
            <MobileFixtureRow key={fixture.id} fixture={fixture} marketView={marketView} />
          ))
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
