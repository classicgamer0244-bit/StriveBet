"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { money } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerTable } from "@/hooks/use-server-table";
import { DataTableSkeleton } from "./data-table-skeleton";
import type { PlacedBet } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-muted text-muted-foreground",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground",
  cashed_out: "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "void", label: "Void" },
  { value: "cashed_out", label: "Cashed Out" },
];

type StakeBet = PlacedBet & { userLabel: string };

export function MatchStakesPanel({ fixtureId }: { fixtureId: string }) {
  const table = useServerTable<StakeBet>({ endpoint: `/api/admin/fixtures/${fixtureId}/stakes`, pageSize: 10, searchable: false });
  const { items: bets, total, page, setPage, totalPages, status, setStatus, hydrated } = table;

  if (!hydrated) return <DataTableSkeleton rows={3} />;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-foreground">Stakes on this match ({total})</h2>
        <Select value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-32" size="sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {bets.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No bets placed on this match yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {bets.map((bet) => {
            const leg = bet.legs.find((l) => l.fixtureId === fixtureId)!;
            return (
              <div key={bet.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{bet.userLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {leg.marketLabel}: <span className="font-medium text-foreground">{leg.selectionLabel}</span> @{" "}
                    {leg.odds.toFixed(2)}
                    {bet.legs.length > 1 && ` · +${bet.legs.length - 1} more`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">{money(bet.stake)}</p>
                  <p className="text-xs text-muted-foreground">→ {money(bet.payout ?? bet.potentialPayout)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLES[bet.status])}>
                  {bet.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 gap-1 px-2">
              <ChevronLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-7 gap-1 px-2"
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
