"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTabVisible } from "@/hooks/use-tab-visible";
import type { BetFixtureState } from "@/lib/bets/fixture-state";
import type { PlacedBet } from "@/types";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface OpenBetsContextValue {
  openBets: PlacedBet[];
  /** Keyed by fixtureId — live status/score/phase for every fixture any open
   * bet's legs reference. See lib/bets/live-line.ts / lib/bets/cashout.ts for
   * what to do with it. */
  fixtureStates: Map<string, BetFixtureState>;
  /** Bets that settled WON or were CASHED_OUT since the player's last
   * acknowledgement — the celebration modal's queue (same modal, different
   * copy per bet.status). */
  pendingWins: PlacedBet[];
  hydrated: boolean;
  /** Forces an immediate re-fetch outside the SSE cadence — used right after
   * placing or cashing out a bet so the UI doesn't wait out the poll interval. */
  refresh: () => void;
  /** Removes bets from the pending-wins queue once their modal has been
   * acknowledged (the API call itself lives in the win modal). */
  clearAcknowledgedWins: (betIds: string[]) => void;
}

export const OpenBetsContext = createContext<OpenBetsContextValue | null>(null);

/**
 * Single shared live feed for open bets — one EventSource backing the bottom
 * nav badge, the My Bets tab count, the open bets list, and the win
 * celebration modal, instead of each running its own poll (see
 * app/api/realtime/my-bets for the server side). Falls back to a one-shot
 * GET /api/bets?status=open so the UI paints before the first SSE push, and
 * whenever logged out or the stream hasn't connected yet.
 */
const EMPTY_FIXTURE_STATES = new Map<string, BetFixtureState>();

export function OpenBetsProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, authLoading, applyPushedBalance } = useAuth();
  const [openBets, setOpenBets] = useState<PlacedBet[]>([]);
  const [fixtureStates, setFixtureStates] = useState<Map<string, BetFixtureState>>(new Map());
  const [pendingWins, setPendingWins] = useState<PlacedBet[]>([]);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const tabVisible = useTabVisible();

  // Initial fetch — paints immediately, before the SSE connection (or its
  // first push) lands. Re-runs on `refresh()` and on login. Nothing to fetch
  // while logged out — the memo below derives empty/hydrated values for that
  // case instead of resetting state from inside this effect.
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      const data = await fetchJson<{ bets: PlacedBet[] }>("/api/bets?status=open");
      if (!cancelled) {
        setOpenBets(data?.bets ?? []);
        setFetchedOnce(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, tick]);

  // Live push — admin-simulated fixtures tick server-side every 2s; this
  // stream re-queries open bets + their fixtures' states each time and only
  // sends a frame when something actually changed. Closed while the tab is
  // hidden (see hooks/use-tab-visible.ts) — this connection is held open for
  // every logged-in user on every page for as long as the tab exists, so a
  // backgrounded tab is the single biggest source of wasted Vercel Fluid
  // "Provisioned Memory" billing in the app if left unpaused.
  useEffect(() => {
    if (!isLoggedIn || !tabVisible) return;
    const es = new EventSource("/api/realtime/my-bets");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          bets: PlacedBet[];
          fixtureStates: Record<string, BetFixtureState>;
          wins: PlacedBet[];
          balance?: number;
        };
        setOpenBets(data.bets);
        // Settlement credits land here within a tick, with no refetch and no
        // dependence on the win modal firing — see applyPushedBalance.
        if (typeof data.balance === "number") applyPushedBalance(data.balance);
        // Merge rather than replace — a fixture briefly absent from one
        // frame (e.g. its bet momentarily excluded from an in-flight query)
        // shouldn't blank out an already-known state and flicker the UI;
        // stale entries for fixtures no open bet references anymore are
        // harmless leftovers, not a correctness issue.
        setFixtureStates((prev) => {
          const next = new Map(prev);
          for (const [id, state] of Object.entries(data.fixtureStates)) next.set(id, state);
          return next;
        });
        setPendingWins(data.wins);
        setFetchedOnce(true);
      } catch {
        // Ignore malformed/heartbeat frames.
      }
    };
    return () => es.close();
  }, [isLoggedIn, tabVisible, applyPushedBalance]);

  // A bet was just placed elsewhere in the app (see betslip-panel.tsx) —
  // force an immediate refetch instead of waiting out the poll interval.
  useEffect(() => {
    window.addEventListener("bets:placed", refresh);
    return () => window.removeEventListener("bets:placed", refresh);
  }, [refresh]);

  const clearAcknowledgedWins = useCallback((betIds: string[]) => {
    setPendingWins((prev) => prev.filter((w) => !betIds.includes(w.id)));
  }, []);

  // Logged out (and not still resolving auth) has nothing to show — derive
  // the empty/hydrated values here instead of resetting state from an
  // effect, so a logout doesn't leave a stale flash of the previous
  // account's bets before this recomputes.
  const value = useMemo<OpenBetsContextValue>(() => {
    if (authLoading) return { openBets: [], fixtureStates: EMPTY_FIXTURE_STATES, pendingWins: [], hydrated: false, refresh, clearAcknowledgedWins };
    if (!isLoggedIn) return { openBets: [], fixtureStates: EMPTY_FIXTURE_STATES, pendingWins: [], hydrated: true, refresh, clearAcknowledgedWins };
    return { openBets, fixtureStates, pendingWins, hydrated: fetchedOnce, refresh, clearAcknowledgedWins };
  }, [authLoading, isLoggedIn, openBets, fixtureStates, pendingWins, fetchedOnce, refresh, clearAcknowledgedWins]);

  return <OpenBetsContext.Provider value={value}>{children}</OpenBetsContext.Provider>;
}
