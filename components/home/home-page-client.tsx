"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/home/section-header";
import { MobileFeaturedMatchCard } from "@/components/home/mobile-featured-match-card";
import { HighlightsTable } from "@/components/fixtures/highlights-table";
import { useUpcomingFixtures } from "@/hooks/use-fixtures";
import { isRealFixtureId } from "@/lib/fixture-id";
import { fetchIlotbetMatchDetail } from "@/lib/ilotbet/browser-fetch";
import type { Fixture } from "@/types";

const SIMULATED_LEAGUE_PATTERN = /simulated|\bsrl\b/i;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function FeaturedFixtures() {
  const { fixtures: upcoming, hydrated } = useUpcomingFixtures();
  const [logoMap, setLogoMap] = useState<Record<string, { home?: string; away?: string }>>({});
  const fetchedIds = useRef(new Set<string>());

  const featured = useMemo(() => {
    return upcoming
      .filter(
        (f) =>
          isRealFixtureId(f.id) &&
          f.sportSlug === "football" &&
          f.status === "upcoming" &&
          !SIMULATED_LEAGUE_PATTERN.test(f.leagueName)
      )
      .slice(0, 4)
      .map((f) => ({ ...f, isHighlight: hashString(f.id) % 10 < 3 }));
  }, [upcoming]);

  useEffect(() => {
    if (!hydrated) return;
    const toFetch = featured.filter((f) => !fetchedIds.current.has(f.id));
    if (toFetch.length === 0) return;
    toFetch.forEach((f) => fetchedIds.current.add(f.id));
    Promise.all(
      toFetch.map(async (f) => {
        const fromServer = await fetch(`/api/fixtures/${f.id}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => (data?.fixture as Fixture | undefined))
          .catch(() => undefined);
        // The server's cache can be empty or behind (e.g. while its upstream
        // sync is blocked) — ilotbet's detail endpoint is CORS-open, so ask it
        // straight from the browser before giving up on the logos.
        const fixture = fromServer?.homeTeam.logoUrl ? fromServer : await fetchIlotbetMatchDetail(f.id).catch(() => undefined);
        return fixture ? { id: f.id, home: fixture.homeTeam.logoUrl, away: fixture.awayTeam.logoUrl } : null;
      })
    ).then((results) => {
      const updates: Record<string, { home?: string; away?: string }> = {};
      for (const r of results) {
        if (r) updates[r.id] = { home: r.home, away: r.away };
      }
      if (Object.keys(updates).length > 0) setLogoMap((prev) => ({ ...prev, ...updates }));
    });
  }, [hydrated, featured]);

  const featuredWithLogos = useMemo(() => {
    return featured.map((f) => {
      const logos = logoMap[f.id];
      if (!logos) return f;
      return {
        ...f,
        homeTeam: { ...f.homeTeam, logoUrl: logos.home ?? f.homeTeam.logoUrl },
        awayTeam: { ...f.awayTeam, logoUrl: logos.away ?? f.awayTeam.logoUrl },
      };
    });
  }, [featured, logoMap]);

  if (hydrated && featuredWithLogos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
    <SectionHeader title="Top matches" icon={Star} href="/sports" />
    <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
      {!hydrated
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[300px] shrink-0 snap-center rounded-2xl border border-border bg-card p-4 md:w-auto">
              {/* badges + league */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-10 rounded-sm" />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              {/* logos + VS + team names */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 flex-col items-center gap-1.5">
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <div className="flex flex-1 flex-col items-center gap-1.5">
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              {/* odds buttons */}
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-8 flex-1 rounded" />
                <Skeleton className="h-8 flex-1 rounded" />
                <Skeleton className="h-8 flex-1 rounded" />
              </div>
            </div>
          ))
        : featuredWithLogos.map((fixture, i) => (
            <div key={fixture.id} className={`w-[300px] shrink-0 snap-center md:w-auto${i === featured.length - 1 ? " mr-3 md:mr-0" : ""}`}>
              <MobileFeaturedMatchCard fixture={fixture} />
            </div>
          ))}
    </div>
    </section>
  );
}

export function HighlightsSection() {
  const { fixtures: upcoming, hydrated } = useUpcomingFixtures();

  const allFixtures = useMemo<Fixture[]>(() => {
    // Capped per sport (not overall), so the sport tabs in HighlightsTable
    // each get a full list.
    const perSport = new Map<string, number>();
    const realHighlights = upcoming.filter((f) => {
      if (!isRealFixtureId(f.id) || SIMULATED_LEAGUE_PATTERN.test(f.leagueName)) return false;
      const n = perSport.get(f.sportSlug) ?? 0;
      perSport.set(f.sportSlug, n + 1);
      return n < 30;
    });
    const adminUpcoming = upcoming.filter((f) => !isRealFixtureId(f.id));
    const highlightIds = new Set(realHighlights.map((f) => f.id));
    const adminOnly = adminUpcoming.filter((f) => !highlightIds.has(f.id));
    return [...realHighlights, ...adminOnly].sort(
      (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
    );
  }, [upcoming]);

  return <HighlightsTable initialFixtures={allFixtures} hydrated={hydrated} />;
}
