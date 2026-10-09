"use client";

import { ChevronRight } from "lucide-react";
import type { Fixture } from "@/types";
import { cn } from "@/lib/utils";

export function LiveMatchListItem({
  fixture,
  isActive,
  onClick,
}: {
  fixture: Fixture;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors",
        isActive ? "bg-primary/15" : "hover:bg-white/5"
      )}
    >
      <div className="w-10 shrink-0 text-[11px] leading-tight">
        <div className="font-bold text-live tabular-nums">{fixture.minute}</div>
        <div className="text-white/40">{fixture.period}</div>
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
        {fixture.homeTeam.name} vs {fixture.awayTeam.name}
      </span>
      {fixture.score && (
        <span className="shrink-0 text-sm font-bold tabular-nums text-white/70">
          {fixture.score.home}:{fixture.score.away}
        </span>
      )}
      <ChevronRight className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-white/30")} />
    </button>
  );
}
