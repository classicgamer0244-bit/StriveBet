export const MARKET_TAB_KEYS = [
  "main",
  "goals",
  "combo",
  "half",
  "corners",
  "cards",
  "intervals",
  "specials",
] as const;

export type MarketTabKey = (typeof MARKET_TAB_KEYS)[number];

export interface Selection {
  id: string;
  label: string;
  odds: number;
  trend?: "up" | "down";
  suspended?: boolean;
}

export interface Market {
  id: string;
  name: string;
  tab: MarketTabKey;
  info?: string;
  selections: Selection[];
}
