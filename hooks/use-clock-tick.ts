"use client";

import { useEffect, useState } from "react";

/** 1-second re-render heartbeat, shared by anything that needs to tick a
 * live match-minute display locally between server pushes (SSE or otherwise)
 * — e.g. hooks/use-fixtures.ts and context/open-bets-context.tsx. */
export function useClockTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}
