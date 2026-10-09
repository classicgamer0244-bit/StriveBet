"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUI } from "@/hooks/use-ui";
import { useLiveFixtures, useUpcomingFixtures } from "@/hooks/use-fixtures";
import { formatKickoffTime } from "@/lib/format-date";
import { EmptyState } from "@/components/common/empty-state";
import { LiveBadge } from "@/components/fixtures/live-badge";
import { TeamCrest } from "@/components/fixtures/team-crest";
import type { Fixture } from "@/types";

const MIN_QUERY_LENGTH = 3;
const RESULTS_CAP = 30;

function matches(fixture: Fixture, query: string): boolean {
  const q = query.toLowerCase();
  return (
    fixture.homeTeam.name.toLowerCase().includes(q) ||
    fixture.awayTeam.name.toLowerCase().includes(q) ||
    fixture.leagueName.toLowerCase().includes(q)
  );
}

function SearchResultRow({ fixture, onSelect }: { fixture: Fixture; onSelect: () => void }) {
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  return (
    <Link
      href={`/sports/${fixture.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50"
    >
      <div className="flex shrink-0 -space-x-2">
        <TeamCrest team={fixture.homeTeam} containerClassName="size-8" imageSize={22} textClassName="text-[9px]" />
        <TeamCrest team={fixture.awayTeam} containerClassName="size-8" imageSize={22} textClassName="text-[9px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {fixture.homeTeam.name} vs {fixture.awayTeam.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{fixture.leagueName}</p>
      </div>
      <div className="shrink-0 text-right text-xs">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <LiveBadge />
            <span className="font-bold tabular-nums text-live">{fixture.minute}</span>
          </div>
        ) : (
          <span className="font-medium text-muted-foreground">{formatKickoffTime(fixture.kickoffAt)}</span>
        )}
      </div>
    </Link>
  );
}

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useUI();
  const [query, setQuery] = useState("");
  const { fixtures: live, hydrated: liveHydrated } = useLiveFixtures();
  const { fixtures: upcoming, hydrated: upcomingHydrated } = useUpcomingFixtures();
  const hydrated = liveHydrated && upcomingHydrated;

  const trimmed = query.trim();
  const results = useMemo(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return [];
    const all = [...live, ...upcoming];
    const seen = new Set<string>();
    const out: Fixture[] = [];
    for (const f of all) {
      if (seen.has(f.id)) continue;
      if (!matches(f, trimmed)) continue;
      seen.add(f.id);
      out.push(f);
      if (out.length >= RESULTS_CAP) break;
    }
    return out;
  }, [live, upcoming, trimmed]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeSearch();
      setQuery("");
    }
  }

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search games</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or leagues…"
            className="h-9 flex-1 border-none px-0 shadow-none focus-visible:ring-0"
          />
          <button
            onClick={() => handleOpenChange(false)}
            aria-label="Close search"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {trimmed.length < MIN_QUERY_LENGTH ? (
            <EmptyState
              title="Search for a game"
              description={`Type at least ${MIN_QUERY_LENGTH} characters to search team or league names.`}
            />
          ) : !hydrated ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <EmptyState
              title="No games found"
              description={`We couldn't find anything matching "${trimmed}". Try a different team or league name.`}
            />
          ) : (
            results.map((fixture) => (
              <SearchResultRow key={fixture.id} fixture={fixture} onSelect={() => handleOpenChange(false)} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
