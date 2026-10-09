"use client";

import { useEffect, useState } from "react";
import type { League } from "@/types";

/** Fetches the configured league allowlist from /api/leagues once, then
 * derives the "Popular"/"A-Z" groupings client-side — mirrors the shape of
 * data/selectors.ts's getPopularLeagues()/getAllLeaguesAZ() (which are
 * identical/sorted views of the same underlying list). */
export function useLeagues(): { popular: League[]; az: League[]; hydrated: boolean } {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leagues", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setLeagues(data?.leagues ?? []);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const az = [...leagues].sort((a, b) => a.name.localeCompare(b.name));
  return { popular: leagues, az, hydrated };
}
