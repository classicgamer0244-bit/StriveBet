"use client";

import { useEffect, useState } from "react";
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

export function useBets(status?: "open" | "settled"): { bets: PlacedBet[]; hydrated: boolean; refresh: () => void } {
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = status ? `/api/bets?status=${status}` : "/api/bets";
      const data = await fetchJson<{ bets: PlacedBet[] }>(url);
      if (!cancelled) {
        setBets(data?.bets ?? []);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, tick]);

  return { bets, hydrated, refresh: () => setTick((t) => t + 1) };
}

export function useBetById(id: string): { bet: PlacedBet | undefined; hydrated: boolean } {
  const [bet, setBet] = useState<PlacedBet | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<{ bet: PlacedBet }>(`/api/bets/${id}`);
      if (!cancelled) {
        setBet(data?.bet);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { bet, hydrated };
}
