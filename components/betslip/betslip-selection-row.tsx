import Link from "next/link";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { BetslipSelection } from "@/context/betslip-context";
import { useBetslip } from "@/hooks/use-betslip";
import { displaySelectionLabel } from "@/lib/betslip-labels";
import { cn } from "@/lib/utils";

export function BetslipSelectionRow({ selection }: { selection: BetslipSelection }) {
  const { removeSelection, setMobileOpen, justChanged } = useBetslip();
  const oddsJustChanged = justChanged.has(selection.fixtureId);

  return (
    <div
      className={cn(
        "border-b border-border py-3 px-2 -mx-2 last:border-b-0 transition-colors duration-1000",
        oddsJustChanged && "bg-amber-100 dark:bg-amber-500/20"
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox defaultChecked className="data-checked:border-success data-checked:bg-success" />
        <span className="flex-1 truncate text-sm font-bold text-foreground">
          {displaySelectionLabel(selection.marketName, selection.selectionLabel)}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-bold tabular-nums text-foreground transition-colors",
            oddsJustChanged && "text-amber-600 dark:text-amber-400"
          )}
        >
          {selection.odds.toFixed(2)}
        </span>
        <button
          onClick={() => removeSelection(selection.fixtureId)}
          aria-label="Remove selection"
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>
      <Link
        href={`/sports/${selection.fixtureId}`}
        onClick={() => setMobileOpen(false)}
        className="mt-1 block truncate pl-6 text-xs text-muted-foreground hover:text-primary hover:underline"
      >
        {selection.fixtureLabel.replace(" vs ", " v ")}
      </Link>
      <p className="truncate pl-6 text-xs text-muted-foreground">{selection.marketLabel}</p>
    </div>
  );
}
