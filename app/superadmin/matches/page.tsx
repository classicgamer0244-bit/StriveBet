"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { MatchList } from "@/components/admin/match-list";
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useServerTable } from "@/hooks/use-server-table";
import type { AdminFixture } from "@/types";

type FixtureRow = AdminFixture & { ownerName?: string };

export default function SuperadminMatchesPage() {
  const table = useServerTable<FixtureRow>({
    endpoint: "/api/superadmin/fixtures",
    pageSize: 20,
    searchable: false,
  });

  const { items, total, page, setPage, totalPages, pageSize, hydrated } = table;

  return (
    <div>
      <OperatorPageHeader title="Matches" description="Every simulated match across all merchants." />
      {!hydrated ? (
        <DataTableSkeleton />
      ) : (
        <div className="flex flex-col gap-3">
          <MatchList
            fixtures={items}
            showOwner
            ownerName={(id) => items.find((f) => f.ownerAdminId === id)?.ownerName ?? "—"}
            basePath="/superadmin/matches"
            showCreate={false}
          />
          {total > table.pageSize && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="gap-1">
                  <ChevronLeft className="size-4" /> Prev
                </Button>
                <span className="tabular-nums">Page {page} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="gap-1">
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
