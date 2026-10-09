"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useBetslip } from "@/hooks/use-betslip";
import { BetslipPanel } from "./betslip-panel";

export function BetslipMobileDrawer() {
  const { mobileOpen, setMobileOpen, count } = useBetslip();

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  if (!mobileOpen) return null;

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm"
        onClick={() => setMobileOpen(false)}
      />
      {/* Sheet — fixed height, not affected by keyboard */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-3xl bg-background"
        style={{ height: count > 0 ? "80vh" : "auto", maxHeight: "80vh" }}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-foreground/15" />
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="text-lg font-extrabold text-foreground">Your Betslip</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close betslip"
            className="flex size-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/60"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <BetslipPanel />
        </div>
      </div>
    </div>
  );
}
