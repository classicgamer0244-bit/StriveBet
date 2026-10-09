import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shown while a fixture list hook is still fetching (see hooks/use-fixtures.ts) —
 * mimics a handful of FixtureRow-shaped placeholders so the layout doesn't jump once real data lands. */
export function FixtureListSkeleton({ rows = 5, dark = false }: { rows?: number; dark?: boolean }) {
  return (
    <div className={cn("flex flex-col divide-y", dark ? "divide-white/10" : "divide-border")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className={cn("h-3.5 w-2/3", dark && "bg-white/10")} />
            <Skeleton className={cn("h-3.5 w-1/2", dark && "bg-white/10")} />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Skeleton className={cn("h-8 w-12", dark && "bg-white/10")} />
            <Skeleton className={cn("h-8 w-12", dark && "bg-white/10")} />
            <Skeleton className={cn("h-8 w-12", dark && "bg-white/10")} />
          </div>
        </div>
      ))}
    </div>
  );
}
