"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { marketDisplayName } from "@/lib/markets/market-label";
import { isRealFixtureId } from "@/lib/fixture-id";
import { fetchIlotbetMatchDetail } from "@/lib/ilotbet/browser-fetch";

export interface BetslipSelection {
  key: string;
  fixtureId: string;
  fixtureLabel: string;
  marketId: string;
  marketName: string;
  /** Friendly display name, e.g. "Match Result" for marketName "1X2" — see
   * lib/markets/market-label.ts. Derived once here so every caller of
   * toggleSelection (odds buttons, correct score grid, booking code load)
   * gets it for free. */
  marketLabel: string;
  selectionId: string;
  selectionLabel: string;
  odds: number;
}

export type BetslipMode = "REAL" | "SIM";

export interface BetslipContextValue {
  selections: Map<string, BetslipSelection>;
  selectionList: BetslipSelection[];
  count: number;
  totalOdds: number;
  stake: number;
  setStake: (stake: number) => void;
  potentialWinnings: number;
  mode: BetslipMode;
  setMode: (mode: BetslipMode) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isSelected: (fixtureId: string, marketId: string, selectionId: string) => boolean;
  toggleSelection: (input: Omit<BetslipSelection, "key" | "marketLabel">) => void;
  removeSelection: (fixtureId: string) => void;
  clearAll: () => void;
  /** fixtureIds whose odds just live-updated — briefly true right after a
   * change lands, for a row to flash and draw the eye to it (odds-button.tsx's
   * trend chevron is the equivalent cue on the odds cards elsewhere; this is
   * that same "don't silently change the number" idea for the betslip). */
  justChanged: Set<string>;
}

export const BetslipContext = createContext<BetslipContextValue | null>(null);

const STORAGE_KEY = "maxbet_betslip_v1";
/** Matches the rest of the app's direct-ilotbet-poll cadence
 * (hooks/use-fixtures.ts's LIVE_POLL_INTERVAL_MS) — the betslip's odds
 * should feel exactly as fresh as everywhere else, not staler or fresher. */
const ODDS_SYNC_INTERVAL_MS = 10_000;
/** How long a row stays flashed after its odds change, in ms. */
const FLASH_DURATION_MS = 2_500;

interface PersistedBetslip {
  selections: BetslipSelection[];
  stake: number;
  mode: BetslipMode;
}

export function BetslipProvider({ children }: { children: ReactNode }) {
  // Keyed by fixtureId (not fixtureId+marketId) — a fixture can only have one
  // active pick at a time, matching how real betting platforms work: picking
  // a different market/selection on the same match replaces the old pick
  // instead of adding alongside it.
  //
  // Initial state must be deterministic and identical on server and client —
  // reading localStorage in a useState initializer (even behind a `typeof
  // window` check) still runs synchronously on the client's first render,
  // before hydration reconciles against the server HTML, so it mismatches
  // whenever a betslip was actually saved. Persisted data is loaded in an
  // effect instead, which only runs after hydration completes.
  const [selections, setSelections] = useState<Map<string, BetslipSelection>>(new Map());
  const [stake, setStake] = useState(10);
  const [mode, setMode] = useState<BetslipMode>("REAL");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [justChanged, setJustChanged] = useState<Set<string>>(new Set());
  // Mirrors `selections` for the odds-sync effect below to read without
  // depending on `selections` itself — depending on it directly would
  // restart the poll's interval timer on every odds update the effect makes,
  // which defeats a steady ODDS_SYNC_INTERVAL_MS cadence.
  const selectionsRef = useRef(selections);
  const flashTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    (async () => {
      await Promise.resolve();
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedBetslip>;
          if (Array.isArray(parsed.selections)) {
            setSelections(new Map(parsed.selections.map((s) => [s.fixtureId, s])));
          }
          if (typeof parsed.stake === "number") setStake(parsed.stake);
          // `mode` is deliberately NOT restored. Demo mode is retired, and a
          // stale "SIM" persisted here from before that change would otherwise
          // survive forever and show a live betslip as a demo one. The server
          // forces REAL regardless (app/api/bets/route.ts), so restoring it
          // could only ever mislead the display.
        }
      } catch {
        // corrupted or old-shape data — ignore and start fresh
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    // Skip the save while the load effect above hasn't run yet — otherwise
    // this fires on the same first commit with the still-default state and
    // clobbers the just-saved betslip before it's ever loaded.
    if (!hydrated) return;
    try {
      const payload: PersistedBetslip = { selections: [...selections.values()], stake, mode };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable (private browsing, quota) — betslip just won't survive a reload
    }
  }, [selections, stake, mode, hydrated]);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  const selectionList = useMemo(() => Array.from(selections.values()), [selections]);
  // Only the SET of picks (not their odds) should restart the poll — a
  // stable signature so an odds update this same effect makes doesn't
  // retrigger itself via selectionList's changed identity.
  const selectionSignature = useMemo(
    () => selectionList.map((s) => `${s.fixtureId}:${s.marketId}:${s.selectionId}`).join("|"),
    [selectionList]
  );

  // Odds cards elsewhere (components/odds/odds-button.tsx) already show
  // live-updated odds the moment ilotbet's price moves — the betslip
  // previously froze a selection's odds at the instant it was added, so a
  // player could sit staring at a stale price indefinitely and place the bet
  // at a number the server would immediately re-price anyway (resolveSelections
  // never trusts client odds). This brings the betslip in line: live-syncs
  // every real-fixture selection's odds on the same cadence as the rest of
  // the app, and flags anything that just changed so the row can flash and
  // draw the eye to it rather than silently swapping the number underneath
  // the player.
  useEffect(() => {
    const realFixtureIds = [...new Set(selectionList.filter((s) => isRealFixtureId(s.fixtureId)).map((s) => s.fixtureId))];
    if (realFixtureIds.length === 0) return;

    let cancelled = false;

    function flashChanged(fixtureIds: string[]) {
      setJustChanged((prev) => new Set([...prev, ...fixtureIds]));
      for (const id of fixtureIds) {
        const existing = flashTimeouts.current.get(id);
        if (existing) clearTimeout(existing);
        flashTimeouts.current.set(
          id,
          setTimeout(() => {
            setJustChanged((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            flashTimeouts.current.delete(id);
          }, FLASH_DURATION_MS)
        );
      }
    }

    async function syncOdds() {
      const fixtures = await Promise.all(realFixtureIds.map((id) => fetchIlotbetMatchDetail(id).catch(() => undefined)));
      if (cancelled) return;
      const fixtureById = new Map(realFixtureIds.map((id, i) => [id, fixtures[i]]));

      const current = selectionsRef.current;
      const next = new Map(current);
      const changedIds: string[] = [];
      for (const [fixtureId, sel] of current) {
        const fixture = fixtureById.get(fixtureId);
        if (!fixture) continue;
        const market = fixture.markets.find((m) => m.id === sel.marketId);
        const liveOdds = market?.selections.find((s) => s.id === sel.selectionId)?.odds;
        if (liveOdds !== undefined && liveOdds !== sel.odds) {
          next.set(fixtureId, { ...sel, odds: liveOdds });
          changedIds.push(fixtureId);
        }
      }
      if (changedIds.length > 0) {
        setSelections(next);
        flashChanged(changedIds);
      }
    }

    void syncOdds();
    const interval = setInterval(syncOdds, ODDS_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on selectionSignature (the stable pick-set), not selectionList itself, which changes identity on every odds update this effect makes
  }, [selectionSignature]);

  const toggleSelection = useCallback((input: Omit<BetslipSelection, "key" | "marketLabel">) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const existing = next.get(input.fixtureId);
      if (existing && existing.marketId === input.marketId && existing.selectionId === input.selectionId) {
        next.delete(input.fixtureId);
      } else {
        next.set(input.fixtureId, { ...input, key: input.fixtureId, marketLabel: marketDisplayName(input.marketName) });
      }
      return next;
    });
  }, []);

  const removeSelection = useCallback((fixtureId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(fixtureId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelections(new Map()), []);

  const isSelected = useCallback(
    (fixtureId: string, marketId: string, selectionId: string) => {
      const entry = selections.get(fixtureId);
      return entry?.marketId === marketId && entry?.selectionId === selectionId;
    },
    [selections]
  );

  const totalOdds = useMemo(
    () => (selectionList.length === 0 ? 0 : selectionList.reduce((acc, s) => acc * s.odds, 1)),
    [selectionList]
  );
  const potentialWinnings = useMemo(() => stake * totalOdds, [stake, totalOdds]);

  const value = useMemo<BetslipContextValue>(
    () => ({
      selections,
      selectionList,
      count: selectionList.length,
      totalOdds,
      stake,
      setStake,
      potentialWinnings,
      mode,
      setMode,
      mobileOpen,
      setMobileOpen,
      isSelected,
      toggleSelection,
      removeSelection,
      clearAll,
      justChanged,
    }),
    [
      selections,
      selectionList,
      totalOdds,
      stake,
      potentialWinnings,
      mode,
      mobileOpen,
      isSelected,
      toggleSelection,
      removeSelection,
      clearAll,
      justChanged,
    ]
  );

  return <BetslipContext.Provider value={value}>{children}</BetslipContext.Provider>;
}
