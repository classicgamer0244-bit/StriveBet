// Selections are stored as real words ("Home"/"Draw"/"Away") since the
// market-label rename — this map only exists to translate any pre-rename
// short-code label still sitting on a frozen admin fixture or an already-
// placed bet (see lib/settlement/resolve-leg.ts's backward-compat notes),
// so old data still displays "Home" instead of a bare "1".
const LABEL_MAP: Record<string, string> = {
  "1": "Home",
  "2": "Away",
  "X": "Draw",
  "1X": "Home or Draw",
  "X2": "Draw or Away",
  "12": "Home or Away",
};

/** Friendlier display labels for legacy shorthand selections, e.g. 1X2's "1"/"X"/"2". */
export function displaySelectionLabel(marketName: string, selectionLabel: string): string {
  // HT/FT intervals: "1/X" → "Home / Draw" etc.
  if (selectionLabel.includes("/")) {
    const parts = selectionLabel.split("/");
    return parts.map((p) => LABEL_MAP[p] ?? p).join(" / ");
  }
  return LABEL_MAP[selectionLabel] ?? selectionLabel;
}

export interface MultiBonusTier {
  minSelections: number;
  percent: number;
}

const MULTI_BONUS_TIERS: MultiBonusTier[] = [
  { minSelections: 5, percent: 10 },
  { minSelections: 4, percent: 7 },
  { minSelections: 3, percent: 5 },
  { minSelections: 2, percent: 3 },
];

export function getMultiBonusPercent(selectionCount: number): number {
  for (const tier of MULTI_BONUS_TIERS) {
    if (selectionCount >= tier.minSelections) return tier.percent;
  }
  return 0;
}
