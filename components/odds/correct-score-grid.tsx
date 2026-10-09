"use client";

import { useState } from "react";
import type { Market, Selection } from "@/types";
import { useBetslip } from "@/hooks/use-betslip";
import { cn } from "@/lib/utils";

function parseScore(label: string): { home: number; away: number } | null {
  const m = label.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

/** Collapsed ("Show more") state hides the less-likely blowout scores —
 * anything where either side has more than 2 goals — down to a 3x3 core. */
function isCommonScore(label: string): boolean {
  const parsed = parseScore(label);
  return parsed ? parsed.home <= 2 && parsed.away <= 2 : true; // "Other" always shows
}

function ScoreCell({
  selection,
  fixtureId,
  fixtureLabel,
  marketId,
  marketName,
  fullWidth,
}: {
  selection: Selection;
  fixtureId: string;
  fixtureLabel: string;
  marketId: string;
  marketName: string;
  fullWidth?: boolean;
}) {
  const { isSelected, toggleSelection } = useBetslip();
  const selected = isSelected(fixtureId, marketId, selection.id);

  return (
    <button
      type="button"
      onClick={() =>
        toggleSelection({
          fixtureId,
          fixtureLabel,
          marketId,
          marketName,
          selectionId: selection.id,
          selectionLabel: selection.label,
          odds: selection.odds,
        })
      }
      className={cn(
        "flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-sm font-semibold transition-colors min-h-11 w-full",
        fullWidth && "justify-center gap-2",
        selected
          ? "border-[#1F6BFF] bg-[#1F6BFF] text-white"
          : "border-[#1F6BFF]/30 bg-[#1F6BFF]/10 text-foreground shadow-sm hover:border-[#1F6BFF]/60 hover:bg-[#1F6BFF]/20"
      )}
    >
      <span className={cn("text-xs font-medium", selected ? "text-white/85" : "text-muted-foreground")}>
        {selection.label}
      </span>
      <span className="tabular-nums">{selection.odds.toFixed(2)}</span>
    </button>
  );
}

export function CorrectScoreGrid({
  market,
  fixtureId,
  fixtureLabel,
}: {
  market: Market;
  fixtureId: string;
  fixtureLabel: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const homeWins: Selection[] = [];
  const draws: Selection[] = [];
  const awayWins: Selection[] = [];
  let other: Selection | undefined;

  for (const s of market.selections) {
    const parsed = parseScore(s.label);
    if (!parsed) {
      if (s.label === "Other") other = s;
      continue;
    }
    if (!expanded && !isCommonScore(s.label)) continue;
    if (parsed.home > parsed.away) homeWins.push(s);
    else if (parsed.home === parsed.away) draws.push(s);
    else awayWins.push(s);
  }

  homeWins.sort((a, b) => {
    const pa = parseScore(a.label)!;
    const pb = parseScore(b.label)!;
    return pa.away - pb.away || pa.home - pb.home;
  });
  draws.sort((a, b) => parseScore(a.label)!.home - parseScore(b.label)!.home);
  awayWins.sort((a, b) => {
    const pa = parseScore(a.label)!;
    const pb = parseScore(b.label)!;
    return pa.home - pb.home || pa.away - pb.away;
  });

  const columns = [homeWins, draws, awayWins];

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="grid grid-cols-3 gap-1.5">
        {columns.map((column, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            {column.map((selection) => (
              <ScoreCell
                key={selection.id}
                selection={selection}
                fixtureId={fixtureId}
                fixtureLabel={fixtureLabel}
                marketId={market.id}
                marketName={market.name}
              />
            ))}
          </div>
        ))}
      </div>

      {other && (
        <ScoreCell
          selection={other}
          fixtureId={fixtureId}
          fixtureLabel={fixtureLabel}
          marketId={market.id}
          marketName={market.name}
          fullWidth
        />
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="py-2 text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
