"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Market } from "@/types";

const MIN_ODDS = 1.01;
const MAX_ODDS = 1000;

function clampOdds(n: number): number {
  if (!Number.isFinite(n)) return MIN_ODDS;
  return Math.round(Math.min(MAX_ODDS, Math.max(MIN_ODDS, n)) * 100) / 100;
}

function EditableOdds({
  odds,
  onCommit,
}: {
  odds: number;
  onCommit: (nextOdds: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(odds));

  function commit() {
    setEditing(false);
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(clampOdds(parsed));
  }

  if (editing) {
    return (
      <Input
        type="number"
        step="0.01"
        min={MIN_ODDS}
        max={MAX_ODDS}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setEditing(false);
            setDraft(String(odds));
          }
        }}
        onFocus={(e) => e.target.select()}
        className="h-6 w-16 px-1.5 py-0 text-right text-xs font-bold tabular-nums"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(odds));
        setEditing(true);
      }}
      className="font-bold tabular-nums text-foreground hover:underline"
      title="Click to edit this odd"
    >
      {odds.toFixed(2)}
    </button>
  );
}

export function MarketPreview({
  markets,
  onOddsChange,
}: {
  markets: Market[];
  onOddsChange: (marketId: string, selectionId: string, nextOdds: number) => void;
}) {
  if (markets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {markets.length} market{markets.length === 1 ? "" : "s"} generated with odds — click any odd to edit it
      </p>
      <div className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
        {markets.map((market) => (
          <div key={market.id} className="px-3 py-2.5">
            <p className="mb-1.5 text-sm font-semibold text-foreground">{market.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {market.selections.map((sel) => (
                <span
                  key={sel.id}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{sel.label}</span>
                  <EditableOdds odds={sel.odds} onCommit={(next) => onOddsChange(market.id, sel.id, next)} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
