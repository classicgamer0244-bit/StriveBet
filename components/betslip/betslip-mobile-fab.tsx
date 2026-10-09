"use client";

import { Ticket } from "lucide-react";
import { usePathname } from "next/navigation";
import { useBetslip } from "@/hooks/use-betslip";

export function BetslipMobileFab() {
  const { count, setMobileOpen } = useBetslip();
  const pathname = usePathname();

  const isVisible = pathname === "/" || pathname.startsWith("/sports");

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label={`Open betslip, ${count} selection${count === 1 ? "" : "s"}`}
      className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary-600/50 text-white shadow-lg lg:hidden"
    >
      <Ticket className="size-6" />
      <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-success text-xs font-bold text-white">
        {count}
      </span>
    </button>
  );
}
