import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** "not-started" covers both a leg whose match genuinely hasn't kicked off
 * yet AND every leg of a CASHED_OUT bet — once cashed out, a bet's legs are
 * no longer tracked for live updates or a real result, so they get the same
 * neutral "nothing to show yet" treatment as a match that hasn't begun. */
export type LegOutcome = "won" | "lost" | "void" | "pending" | "not-started";

const SIZES = {
  sm: { badge: "size-4", check: "size-3", clock: "size-4" },
  md: { badge: "size-5", check: "size-3.5", clock: "size-5" },
} as const;

/**
 * Shared per-leg outcome indicator — a white check on a filled circle for a
 * decided leg (green = won, red = lost), otherwise a clock (dark for
 * pending/not-started, gray for void) — used identically in the open bets
 * list (components/account/open-bets-list.tsx) and the settled ticket detail
 * page (app/account/bet-history/[ticketId]/page.tsx) so the same visual
 * language means the same thing everywhere.
 */
export function LegOutcomeIcon({
  outcome,
  size = "sm",
  className,
}: {
  outcome: LegOutcome;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];

  if (outcome === "won" || outcome === "lost") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          s.badge,
          outcome === "won" ? "bg-[#1B7C33]" : "bg-[#E53935]",
          className
        )}
      >
        <Check className={cn(s.check, "text-white")} strokeWidth={3} />
      </div>
    );
  }

  return <Clock className={cn(s.clock, outcome === "void" ? "text-[#999999]" : "text-foreground", className)} />;
}
