"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getGrandPrizeWinners } from "@/data/selectors";

export function GrandPrizeWinners() {
  // Math.random() is impure — shuffling during the initial render means the
  // server and the client's first render pick different orders, which is a
  // hydration mismatch. Render deterministically (first 8, original order)
  // on that first render, then shuffle client-side afterward — a normal
  // post-hydration state update, not part of what has to match the server.
  const [winners, setWinners] = useState(() => getGrandPrizeWinners().slice(0, 8));

  useEffect(() => {
    (async () => {
      await Promise.resolve();
      setWinners([...getGrandPrizeWinners()].sort(() => Math.random() - 0.5).slice(0, 8));
    })();
  }, []);

  const items = [...winners, ...winners];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-foreground">
        <span className="size-2 animate-pulse rounded-full bg-success" />
        Recent big wins
      </h3>

      {/* Desktop: original vertical list */}
      <ul className="hidden flex-col gap-3 lg:flex">
        {winners.map((winner) => (
          <li key={winner.id} className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-volt text-navy">
              <Trophy className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-success tabular-nums">
                {winner.currency} {winner.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {winner.category} · {winner.maskedPhone}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{winner.timeAgo}</span>
          </li>
        ))}
      </ul>

      {/* Mobile: auto-scrolling horizontal ticker */}
      <div className="relative overflow-hidden lg:hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent" />
        <div className="flex w-max animate-ticker gap-3 hover:[animation-play-state:paused]">
          {items.map((winner, i) => (
            <div
              key={`${winner.id}-${i}`}
              className="flex shrink-0 items-center gap-2.5 rounded-xl bg-muted/70 px-3 py-2.5"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-volt text-navy">
                <Trophy className="size-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-success tabular-nums">
                  {winner.currency} {winner.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {winner.maskedPhone} · {winner.category}
                </p>
              </div>
              <span className="ml-1 shrink-0 text-[10px] text-muted-foreground/60">{winner.timeAgo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
