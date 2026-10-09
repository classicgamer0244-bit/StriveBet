"use client";

import { useEffect, useState } from "react";

/** Tracks whether this browser tab is currently visible. Backs every
 * long-lived EventSource in the app (context/live-feed-context.tsx,
 * context/open-bets-context.tsx, hooks/use-fixtures.ts's useFixtureById,
 * components/admin/live-score-control.tsx) so a backgrounded tab closes its
 * connection instead of polling — and billing Vercel's Fluid compute for
 * provisioned memory — for a stream nobody is looking at. Defaults to `true`
 * so SSR/first paint opens the connection as before; the effect corrects it
 * on mount if the tab happens to start hidden. */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}
