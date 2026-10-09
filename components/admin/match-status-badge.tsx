import type { FixtureStatus } from "@/types";
import { cn } from "@/lib/utils";

const STYLES: Record<FixtureStatus, string> = {
  upcoming: "bg-muted text-muted-foreground",
  live: "bg-live/15 text-live",
  halftime: "bg-live/15 text-live",
  finished: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export function MatchStatusBadge({ status, minute }: { status: FixtureStatus; minute?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", STYLES[status])}>
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-live" />}
      {status === "live" ? `LIVE ${minute ?? ""}`.trim() : status === "halftime" ? "HT" : status.toUpperCase()}
    </span>
  );
}
