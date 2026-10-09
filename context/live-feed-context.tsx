"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isRealFixtureId } from "@/lib/fixture-id";
import { fetchIlotbetLiveFixtures, fetchIlotbetUpcomingFixtures } from "@/lib/ilotbet/browser-fetch";
import { useTabVisible } from "@/hooks/use-tab-visible";
import { dedupeById, withTrends, LIVE_POLL_INTERVAL_MS, UPCOMING_POLL_INTERVAL_MS, type FixturesResult } from "@/hooks/use-fixtures";
import type { Fixture } from "@/types";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface LiveFeedContextValue {
  /** Unfiltered (all sports) live admin + real fixtures. */
  live: FixturesResult;
  /** Unfiltered (all sports) upcoming admin + real fixtures. */
  upcoming: FixturesResult;
}

const LiveFeedContext = createContext<LiveFeedContextValue | null>(null);

/**
 * One shared subscription per browser tab for the unfiltered live/upcoming
 * fixture lists, instead of every consumer opening its own. Before this,
 * hooks/use-fixtures.ts's useLiveFixtures() opened its own independent
 * EventSource to /api/realtime/fixtures per call site — search-overlay.tsx,
 * live-betting-widget.tsx, sport-filter-pills.tsx and single-view/multi-view
 * each ran one, so a single page load could hold 2-3 duplicate SSE
 * connections open for the exact same admin-fixtures push, every one of
 * them billed as a separate long-lived Vercel invocation. This provider
 * fetches once (admin fixtures pushed via SSE, real/ilotbet fixtures polled
 * directly from the browser per lib/ilotbet/browser-fetch.ts) and every
 * consumer reads the shared result via useLiveFixtures()/useUpcomingFixtures()
 * in hooks/use-fixtures.ts, which layer per-sport filtering on top of this
 * unfiltered data client-side — admin-fixture volume is small enough that
 * shipping the full list and filtering in JS is cheaper than a second
 * network subscription per sport.
 *
 * All fetching pauses while the tab is hidden (useTabVisible) — the biggest
 * lever against Vercel's Fluid "Provisioned Memory" billing, which charges
 * for the full wall-clock life of a streaming connection even while nothing
 * changes, including a backgrounded tab nobody is looking at.
 */
export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const [adminLive, setAdminLive] = useState<Fixture[]>([]);
  const [realLive, setRealLive] = useState<Fixture[]>([]);
  const [liveHydrated, setLiveHydrated] = useState(false);

  const [adminUpcoming, setAdminUpcoming] = useState<Fixture[]>([]);
  const [realUpcoming, setRealUpcoming] = useState<Fixture[]>([]);
  const [upcomingHydrated, setUpcomingHydrated] = useState(false);

  const tabVisible = useTabVisible();

  // Initial combined fetches — whatever the server rendered, split into the
  // buckets each mechanism then owns. Run once regardless of tab visibility
  // so first paint is never empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [data, realData] = await Promise.all([
        fetchJson<{ fixtures: Fixture[] }>("/api/fixtures?status=live"),
        fetchIlotbetLiveFixtures().catch(() => []),
      ]);
      if (cancelled) return;
      if (data) {
        setAdminLive(data.fixtures.filter((f) => !isRealFixtureId(f.id) && (f.status === "live" || f.status === "halftime")));
      }
      setRealLive(realData.length > 0 ? realData : (data?.fixtures.filter((f) => isRealFixtureId(f.id)) ?? []));
      setLiveHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [data, realData] = await Promise.all([
        fetchJson<{ fixtures: Fixture[] }>("/api/fixtures?status=upcoming"),
        fetchIlotbetUpcomingFixtures().catch(() => []),
      ]);
      if (cancelled) return;
      if (data) {
        setAdminUpcoming(data.fixtures.filter((f) => !isRealFixtureId(f.id)));
      }
      setRealUpcoming(realData.length > 0 ? realData : (data?.fixtures.filter((f) => isRealFixtureId(f.id)) ?? []));
      setUpcomingHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Admin live fixtures: pushed via SSE, closed while the tab is hidden.
  useEffect(() => {
    if (!tabVisible) return;
    const es = new EventSource("/api/realtime/fixtures");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { fixtures: Fixture[] };
        setAdminLive(data.fixtures);
      } catch {
        // Ignore malformed/heartbeat frames.
      }
    };
    return () => es.close();
  }, [tabVisible]);

  // Real live fixtures: direct-from-browser poll, paused while hidden.
  useEffect(() => {
    if (!tabVisible) return;
    let cancelled = false;
    async function poll() {
      try {
        const fixtures = await fetchIlotbetLiveFixtures();
        if (!cancelled) setRealLive((prev) => withTrends(fixtures, prev));
      } catch (err) {
        // Expected under normal network hiccups (dropped connection, page
        // navigation cancelling an in-flight request) — next poll recovers.
        // console.warn, not .error, so it doesn't trip the dev error overlay.
        console.warn("Direct ilotbet live fetch failed:", err);
      }
    }
    const interval = setInterval(poll, LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tabVisible]);

  // Real upcoming fixtures: direct-from-browser poll, paused while hidden.
  // No SSE counterpart — upcoming fixtures never need sub-minute freshness.
  useEffect(() => {
    if (!tabVisible) return;
    let cancelled = false;
    async function poll() {
      try {
        const fixtures = await fetchIlotbetUpcomingFixtures();
        if (!cancelled) setRealUpcoming((prev) => withTrends(fixtures, prev));
      } catch (err) {
        // See the matching comment in the live-fixtures poll above.
        console.warn("Direct ilotbet upcoming fetch failed:", err);
      }
    }
    const interval = setInterval(poll, UPCOMING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tabVisible]);

  const value = useMemo<LiveFeedContextValue>(
    () => ({
      live: { fixtures: dedupeById([...adminLive, ...realLive]), hydrated: liveHydrated },
      upcoming: { fixtures: dedupeById([...adminUpcoming, ...realUpcoming]), hydrated: upcomingHydrated },
    }),
    [adminLive, realLive, liveHydrated, adminUpcoming, realUpcoming, upcomingHydrated]
  );

  return <LiveFeedContext.Provider value={value}>{children}</LiveFeedContext.Provider>;
}

export function useLiveFeedContext(): LiveFeedContextValue {
  const ctx = useContext(LiveFeedContext);
  if (!ctx) throw new Error("useLiveFeedContext must be used within a LiveFeedProvider");
  return ctx;
}
