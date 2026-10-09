"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { ChevronDown, Check, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/constants";
import { EmptyState } from "@/components/common/empty-state";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface MyTransaction {
  id: string;
  type: "deposit" | "withdrawal" | "adjustment" | "bet" | "winning" | "refund";
  status: "pending" | "success" | "failed";
  amount: number;
  method: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "bet", label: "Bets" },
  { value: "winning", label: "Winnings" },
  { value: "refund", label: "Refunds" },
  { value: "tax", label: "Withholding Tax" },
] as const;

// Money in vs. money out per type. "adjustment" is legacy-only — no route
// creates it anymore (superadmin credits and earnings settlements are both
// DEPOSIT now) — shown and filtered as a Deposit too so old rows read the
// same way as new ones.
const TYPE_DISPLAY: Record<MyTransaction["type"], { label: string; sign: "+" | "-"; positive: boolean }> = {
  deposit: { label: "Deposit", sign: "+", positive: true },
  withdrawal: { label: "Withdrawal", sign: "-", positive: false },
  adjustment: { label: "Deposit", sign: "+", positive: true },
  bet: { label: "Bet Stake", sign: "-", positive: false },
  winning: { label: "Winnings", sign: "+", positive: true },
  refund: { label: "Refund", sign: "+", positive: true },
};

type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function MyTransactionsList() {
  const [transactions, setTransactions] = useState<MyTransaction[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [category, setCategory] = useState<CategoryValue>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      setTransactions(data?.transactions ?? []);
    } finally {
      setHydrated(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/transactions", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setTransactions(data?.transactions ?? []);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close date dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // "adjustment" displays as a Deposit (see TYPE_DISPLAY), so it must
      // also match the "Deposits" filter — otherwise a row labeled Deposit
      // would vanish the moment someone filters by that exact category.
      const matchesCategory = t.type === category || (category === "deposit" && t.type === "adjustment");
      if (category !== "all" && !matchesCategory) return false;
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (new Date(t.createdAt) < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (new Date(t.createdAt) > to) return false;
      }
      return true;
    });
  }, [transactions, category, fromDate, toDate]);

  const activeCategoryLabel = CATEGORIES.find((c) => c.value === category)?.label ?? "All Categories";
  const dateLabel = fromDate || toDate
    ? [fromDate, toDate].filter(Boolean).join(" → ")
    : "Date";

  if (!hydrated) return (
    <div className="flex items-center justify-center py-16">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-[#1F6BFF]" />
    </div>
  );

  return (
    <PullToRefresh onRefresh={load}>
      <div className="flex flex-col gap-3">

      {/* Filters row */}
      <div className="flex">

        {/* Category dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 items-center justify-between gap-2 rounded-none border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <span className="truncate">{activeCategoryLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {CATEGORIES.map((c) => (
              <DropdownMenuItem
                key={c.value}
                onClick={() => setCategory(c.value)}
                className="flex items-center justify-between"
              >
                {c.label}
                {category === c.value && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date dropdown */}
        <div ref={dateRef} className="relative flex-1">
          <button
            onClick={() => setDateOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-none border border-l-0 border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{dateLabel}</span>
            </div>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", dateOpen && "rotate-180")} />
          </button>

          {dateOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover p-3 shadow-md">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setFromDate(""); setToDate(""); }}
                    className="flex-1 rounded-md border border-border py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setDateOpen(false)}
                    className="flex-1 rounded-md bg-[#1F6BFF] py-1.5 text-xs font-semibold text-white hover:bg-[#1453CC]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState title="No transactions found" description="Try adjusting your filters." />
      ) : (
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {filtered.map((t) => {
            const display = TYPE_DISPLAY[t.type];
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {display.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-medium tabular-nums", display.positive ? "text-success" : "text-foreground")}>
                    <span className="text-sm font-bold">{display.sign}</span>{" "}{CURRENCY} {t.amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    t.status === "success" ? "bg-success/15 text-success" : t.status === "pending" ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
                  )}>
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
