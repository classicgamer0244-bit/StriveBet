"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inclusive from/to date filter for an operator list — mounts into
 * PaginatedDataTable's `toolbarEnd` slot. Same popover shape as the
 * player-facing date filter in components/account/my-transactions-list.tsx
 * (native <input type="date"> ×2, buffered locally, committed on Apply),
 * lifted out into a reusable component since deposits/withdrawals/
 * transactions on both the admin and superadmin side all need it now.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  // Buffered locally so a half-picked range doesn't refetch on every click —
  // committed to the parent (and so to the fetch) only on Apply/Clear.
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function openPopover() {
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
    setOpen((prev) => !prev);
  }

  function apply() {
    onChange(draftFrom || undefined, draftTo || undefined);
    setOpen(false);
  }

  function clear() {
    setDraftFrom("");
    setDraftTo("");
    onChange(undefined, undefined);
    setOpen(false);
  }

  const label = from || to ? [from, to].filter(Boolean).join(" → ") : "Date";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPopover}
        className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="max-w-40 truncate">{label}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover p-3 shadow-md">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">From</label>
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">To</label>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={clear}
                className="flex-1 rounded-md border border-border py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
