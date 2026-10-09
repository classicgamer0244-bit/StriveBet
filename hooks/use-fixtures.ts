"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeMatchPhase } from "@/lib/simulation/phase";
import { isRealFixtureId } from "@/lib/fixture-id";
import { fetchIlotbetLiveFixtures, fetchIlotbetUpcomingFixtures } from "@/lib/ilotbet/browser-fetch";
import { useClockTick } from "./use-clock-tick";
import { useTabVisible } from "./use-tab-visible";
import { useLiveFeedContext } from "@/context/live-feed-context";
import type { Fixture, SportSlug, Selection } from "@/types";

/**
 * Client read hooks. Admin-simulated and real (ilotbet) fixtures are kept
 * fresh through two DELIBERATELY different mechanisms, merged client-side:
 * - Admin fixtures: ours to push. Server-Sent Events (app/api/realtime/
 *   fixtures*) stream updates from our own backend, same as always.
 * - Real fixtures: fetched DIRECTLY from ilotbet.com, straight from the
 *   browser (lib/ilotbet/browser-fetch.ts), on a plain interval — no MaxBet
 *   backend involved in keeping these fresh. This is deliberate: ilotbet's
 *   endpoints are public, CORS-open, and cache on their own side, and going
 *   straight to them avoids this app's own cache ever being a stale
 *   middleman between "ilotbet says it's live" and "the player sees it's
 *   live." Our backend's ilotbet sync (lib/ilotbet/sync/*) still exists and
 *   still runs — it's what serves the very first server-rendered paint
 *   (before any client JS has run) and what settlement is built on — this
 *   is purely an after-hydration refresh strategy, independent of that.
 *
 * Both sources start from the same initial combined fetch (whatever the
 * server rendered), then diverge: admin fixtures get replaced wholesale by
 * each SSE push, real fixtures get replaced wholesale by each direct-fetch
 * poll. Display is always the de-duplicated union of both buckets.
 */

export interface FixturesResult {
  fixtures: Fixture[];
  hydrated: boolean;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Defensive: a fixture id should never repeat within one list, but multiple
 * upstream sources get merged here (admin + real) — de-duplicate by id
 * rather than relying on every upstream source being perfectly disjoint.
 * Exported for context/live-feed-context.tsx, which performs the same merge
 * at the shared-provider level. */
export function dedupeById(fixtures: Fixture[]): Fixture[] {
  const seen = new Set<string>();
  const out: Fixture[] = [];
  for (const f of fixtures) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

/** Stamps trend on each selection by comparing incoming odds against the
 * previously stored fixtures. Up/down/unchanged — resets on every poll so
 * the caret is only visible until the next fetch. Exported for
 * context/live-feed-context.tsx's real-fixtures polls. */
export function withTrends(incoming: Fixture[], previous: Fixture[]): Fixture[] {
  const prevMap = new Map(previous.map((f) => [f.id, f]));
  return incoming.map((fixture) => {
    const prev = prevMap.get(fixture.id);
    if (!prev) return fixture;
    return {
      ...fixture,
      markets: fixture.markets.map((market) => {
        const prevMarket = prev.markets.find((m) => m.id === market.id);
        return {
          ...market,
          selections: market.selections.map((sel) => {
            const prevSel = prevMarket?.selections.find((s) => s.id === sel.id);
            const trend: Selection["trend"] = !prevSel
              ? undefined
              : sel.odds > prevSel.odds
              ? "up"
              : sel.odds < prevSel.odds
              ? "down"
              : undefined;
            return { ...sel, trend };
          }),
        };
      }),
    };
  });
}

/** Recomputes the display minute for admin-origin live/halftime fixtures
 * from their phase anchor — never mutates the source object. Real fixtures
 * have no `.phase`, so this is a no-op for them; their minute comes
 * pre-formatted from ilotbet on each poll instead. Exported so useLiveFixtures
 * below can apply it per-consumer over the shared context/live-feed-context.tsx
 * data (each consumer ticks its own local clock via useClockTick — cheap,
 * no network — rather than the provider ticking one clock for everybody). */
export function withLiveMinute(fixture: Fixture, now: number): Fixture {
  if (!fixture.phase || (fixture.status !== "live" && fixture.status !== "halftime")) return fixture;
  const phase = computeMatchPhase(fixture.phase, now);
  return { ...fixture, minute: phase.label };
}

/** Exported for context/live-feed-context.tsx, which owns the actual polls
 * these intervals used to drive per-consumer. */
export const LIVE_POLL_INTERVAL_MS = 10_000;
export const UPCOMING_POLL_INTERVAL_MS = 60_000;

interface FixturesOnceOptions {
  /** Fetches REAL fixtures directly from ilotbet.com; polled on
   * realPollIntervalMs. */
  fetchReal: () => Promise<Fixture[]>;
  realPollIntervalMs: number;
}

/** Fetch-once-then-poll, no SSE — the by-league lookup below is the only
 * remaining caller. (useLiveFixtures/useUpcomingFixtures used to be built on
 * this too, each instance opening its own EventSource; they now read the
 * single shared subscription in context/live-feed-context.tsx instead — see
 * that file's doc comment.) */
function useFixturesOnce(url: string, { fetchReal, realPollIntervalMs }: FixturesOnceOptions): FixturesResult {
  const [adminFixtures, setAdminFixtures] = useState<Fixture[]>([]);
  const [realFixtures, setRealFixtures] = useState<Fixture[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Initial combined fetch — whatever the server rendered (admin + real
  // merged), split into the two buckets each mechanism then owns.
  // Runs in parallel with the first real fetch so hydration waits for both.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [data, realData] = await Promise.all([
        fetchJson<{ fixtures: Fixture[] }>(url),
        fetchReal(),
      ]);
      if (cancelled) return;
      if (data) {
        setAdminFixtures(data.fixtures.filter((f) => !isRealFixtureId(f.id) && (f.status === "live" || f.status === "halftime")));
      }
      // Prefer the fresh direct fetch over the cached backend response
      // for real fixtures — it's always more up-to-date.
      setRealFixtures(realData.length > 0 ? realData : (data?.fixtures.filter((f) => isRealFixtureId(f.id)) ?? []));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Real fixtures: fetched directly from ilotbet.com, from the browser, on
  // a plain interval — no MaxBet backend involved in this refresh.
  // The first fetch is handled by the initial effect above; this just keeps
  // things fresh on the polling interval.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const fixtures = await fetchReal();
        if (!cancelled) setRealFixtures((prev) => withTrends(fixtures, prev));
      } catch (err) {
        console.error("Direct ilotbet fetch failed:", err);
      }
    }
    const interval = setInterval(poll, realPollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchReal is a fresh closure per render by design (captures sport/league), re-subscribing on identity change would just restart the same interval
  }, [realPollIntervalMs]);

  const displayed = useMemo(() => dedupeById([...adminFixtures, ...realFixtures]), [adminFixtures, realFixtures]);

  return { fixtures: displayed, hydrated };
}

/** Reads the single shared live-fixtures subscription (context/live-feed-
 * context.tsx) and filters it to `sport` client-side, instead of opening its
 * own EventSource per call site the way this used to. See that file's doc
 * comment for why. */
export function useLiveFixtures(sport?: SportSlug): FixturesResult {
  const { live } = useLiveFeedContext();
  const now = useClockTick(true);
  return useMemo(() => {
    const filtered = sport ? live.fixtures.filter((f) => f.sportSlug === sport) : live.fixtures;
    return { fixtures: filtered.map((f) => withLiveMinute(f, now)), hydrated: live.hydrated };
  }, [live, sport, now]);
}

/** Same shared-context pattern as useLiveFixtures above. */
export function useUpcomingFixtures(sport?: SportSlug): FixturesResult {
  const { upcoming } = useLiveFeedContext();
  return useMemo(() => {
    const filtered = sport ? upcoming.fixtures.filter((f) => f.sportSlug === sport) : upcoming.fixtures;
    return { fixtures: filtered, hydrated: upcoming.hydrated };
  }, [upcoming, sport]);
}

export function useFixturesByLeague(leagueId: string): FixturesResult {
  const fetchReal = useCallback(async () => {
    const [live, upcoming] = await Promise.all([fetchIlotbetLiveFixtures(), fetchIlotbetUpcomingFixtures()]);
    return [...live, ...upcoming].filter((f) => f.leagueId === leagueId);
  }, [leagueId]);
  return useFixturesOnce(`/api/fixtures?league=${encodeURIComponent(leagueId)}`, {
    fetchReal,
    realPollIntervalMs: UPCOMING_POLL_INTERVAL_MS,
  });
}

export interface FixtureLookup {
  fixture: Fixture | undefined;
  hydrated: boolean;
}

const DETAIL_POLL_INTERVAL_MS = LIVE_POLL_INTERVAL_MS;

export function useFixtureById(id: string): FixtureLookup {
  const [fixture, setFixture] = useState<Fixture | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const isReal = isRealFixtureId(id);
  const tabVisible = useTabVisible();

  // Initial fetch — for real fixtures this hits ilotbet server-side (logos
  // always present); for admin fixtures it reads from our DB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<{ fixture: Fixture }>(`/api/fixtures/${id}`);
      if (cancelled) return;
      setFixture(data?.fixture);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Admin fixtures: live SSE updates. Closed while the tab is hidden (see
  // hooks/use-tab-visible.ts), and closed for good once the fixture is
  // finished — nothing will ever change again, so there's no reason for the
  // browser to keep reconnecting to it.
  useEffect(() => {
    if (isReal || !tabVisible) return;
    const es = new EventSource(`/api/realtime/fixtures/${id}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { fixture: Fixture };
        if (data.fixture && data.fixture.id === id) {
          setFixture(data.fixture);
          if (data.fixture.status === "finished") es.close();
        }
      } catch {
        // Ignore malformed/heartbeat frames.
      }
    };
    return () => es.close();
  }, [id, isReal, tabVisible]);

  // Real fixtures: poll directly from ilotbet via our API route to keep
  // odds/score fresh without a full page reload.
  useEffect(() => {
    if (!isReal) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const data = await fetchJson<{ fixture: Fixture }>(`/api/fixtures/${id}`);
      if (!cancelled && data?.fixture) setFixture(data.fixture);
    }, DETAIL_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, isReal]);

  const now = useClockTick(Boolean(fixture && (fixture.status === "live" || fixture.status === "halftime")));
  const displayed = useMemo(() => (fixture ? withLiveMinute(fixture, now) : fixture), [fixture, now]);

  return { fixture: displayed, hydrated };
}
