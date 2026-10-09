"use client";

import { cn } from "@/lib/utils";

export const MARKET_VIEWS = [
  { key: "1x2", label: "1X2", marketName: "1X2" },
  { key: "ou", label: "O/U", marketName: "Total 2.5" },
  { key: "dc", label: "DC", marketName: "Double Chance" },
  { key: "1st-half", label: "1st Half", marketName: "1st Half Result" },
  { key: "handicap", label: "Handicap", marketName: "3 Way Handicap +1 +1" },
] as const;

export type MarketViewKey = (typeof MARKET_VIEWS)[number]["key"];

export function marketNameForView(view: MarketViewKey) {
  return MARKET_VIEWS.find((v) => v.key === view)?.marketName ?? "1X2";
}

export function MobileMarketViewTabs({
  value,
  onChange,
  dark = false,
}: {
  value: MarketViewKey;
  onChange: (view: MarketViewKey) => void;
  dark?: boolean;
}) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto border-b px-3 py-2", dark ? "border-white/10" : "border-border")}>
      {MARKET_VIEWS.map((view) => (
        <button
          key={view.key}
          onClick={() => onChange(view.key)}
          className={cn(
            "shrink-0 border-b-2 px-1 pb-1 text-sm font-bold whitespace-nowrap",
            value === view.key
              ? "border-primary" + (dark ? " text-white" : " text-foreground")
              : "border-transparent" + (dark ? " text-white/40 hover:text-white" : " text-muted-foreground hover:text-foreground")
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
