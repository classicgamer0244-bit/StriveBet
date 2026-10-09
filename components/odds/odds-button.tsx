"use client";

import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import type { Selection } from "@/types";
import { useBetslip } from "@/hooks/use-betslip";
import { cn } from "@/lib/utils";
import { displaySelectionLabel } from "@/lib/betslip-labels";

export interface OddsButtonProps {
  fixtureId: string;
  fixtureLabel: string;
  marketId: string;
  marketName: string;
  selection: Selection;
  /** "stacked" puts the label above the price — for narrow card columns,
   * where "Away 100.00" on one line would overflow. */
  variant?: "compact" | "detailed" | "stacked";
  dark?: boolean;
  /** Cosmetic "best odds / featured pick" tint — independent of betslip selection. */
  highlight?: boolean;
  className?: string;
}

export function OddsButton({
  fixtureId,
  fixtureLabel,
  marketId,
  marketName,
  selection,
  variant = "detailed",
  dark = false,
  highlight = false,
  className,
}: OddsButtonProps) {
  const { isSelected, toggleSelection } = useBetslip();
  const selected = isSelected(fixtureId, marketId, selection.id);

  if (selection.suspended) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center border",
          !className?.includes("rounded") && "rounded-md",
          !className?.includes("h-") && "min-h-11",
          dark
            ? "border-white/10 bg-white/5 text-white/30"
            : "border-border bg-muted text-muted-foreground",
          className
        )}
        aria-label={`${selection.label} suspended`}
      >
        <Lock className="size-4" />
      </div>
    );
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleSelection({
      fixtureId,
      fixtureLabel,
      marketId,
      marketName,
      selectionId: selection.id,
      selectionLabel: selection.label,
      odds: selection.odds,
    });
  }

  const idleClass = dark
    ? "border-white/10 bg-white/[0.06] text-white hover:border-volt/60 hover:bg-white/10"
    : "border-transparent bg-muted/70 text-foreground hover:border-primary/50 hover:bg-primary/5";
  const highlightClass = dark
    ? "border-volt/50 bg-volt/10 text-white"
    : "border-volt bg-volt/25 text-foreground";

  if (variant === "stacked") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={selected}
        className={cn(
          "flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden border px-1 py-1.5 transition-all active:scale-95",
          !className?.includes("rounded") && "rounded-lg",
          !className?.includes("h-") && "min-h-11",
          selected ? "border-primary bg-primary text-white shadow-md shadow-primary/30" : highlight ? highlightClass : idleClass,
          className
        )}
      >
        <span
          className={cn(
            "w-full truncate text-center text-[10px] leading-none font-medium",
            selected ? "text-white/85" : dark ? "text-white/50" : "text-muted-foreground"
          )}
        >
          {displaySelectionLabel(marketName, selection.label)}
        </span>
        <span className="flex max-w-full min-w-0 items-center justify-center gap-0.5 text-sm leading-tight font-extrabold tabular-nums">
          <span className="truncate">{selection.odds.toFixed(2)}</span>
          {selection.trend === "up" && <ChevronUp className={cn("size-3 shrink-0", selected ? "text-white" : "text-green-500")} />}
          {selection.trend === "down" && <ChevronDown className={cn("size-3 shrink-0", selected ? "text-white" : "text-red-500")} />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-center gap-1 border text-[13px] font-bold transition-all active:scale-95 px-1.5 py-1",
        !className?.includes("rounded") && "rounded-lg",
        !className?.includes("h-") && "min-h-9",
        selected ? "border-primary bg-primary text-white shadow-md shadow-primary/30" : highlight ? highlightClass : idleClass,
        className
      )}
    >
      {(variant === "detailed") && (
        <span className={cn("text-[11px] font-medium", selected ? "text-white/85" : dark ? "text-white/50" : "text-muted-foreground")}>
          {displaySelectionLabel(marketName, selection.label)}
        </span>
      )}
      <span className="flex items-center justify-center gap-0.5 tabular-nums">
        <span>{selection.odds.toFixed(2)}</span>
        {selection.trend === "up" && <ChevronUp className={cn("size-3 shrink-0", selected ? "text-white" : "text-green-500")} />}
        {selection.trend === "down" && <ChevronDown className={cn("size-3 shrink-0", selected ? "text-white" : "text-red-500")} />}
      </span>
    </button>
  );
}
