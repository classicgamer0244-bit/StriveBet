import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a dashboard list page's data is still fetching — mimics
 * DataTable's header/row shape so the layout doesn't jump once real data lands. */
export function DataTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-3.5 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
