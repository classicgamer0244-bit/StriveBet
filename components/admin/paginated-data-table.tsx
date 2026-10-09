"use client";

import type { ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "./data-table";
import { DataTableSkeleton } from "./data-table-skeleton";
import type { useServerTable } from "@/hooks/use-server-table";

interface StatusOption {
  value: string;
  label: string;
}

/** Search box + optional status filter + DataTable + pager footer, all
 * driven by a useServerTable() instance — the shared shell every paginated
 * admin/superadmin list renders inside. */
export function PaginatedDataTable<T>({
  table,
  columns,
  keyOf,
  empty = "No records yet.",
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search…",
  statusOptions,
  statusPlaceholder = "All statuses",
  toolbarEnd,
}: {
  table: ReturnType<typeof useServerTable<T>>;
  columns: Column<T>[];
  keyOf: (row: T) => string;
  empty?: string;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  statusPlaceholder?: string;
  toolbarEnd?: ReactNode;
}) {
  const { items, total, page, setPage, totalPages, search, setSearch, status, setStatus, hydrated } = table;

  const from = total === 0 ? 0 : (page - 1) * table.pageSize + 1;
  const to = Math.min(total, page * table.pageSize);

  return (
    <div className="flex flex-col gap-3">
      {(searchable || statusOptions || toolbarEnd) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-8" />
            </div>
          )}
          {statusOptions && (
            <Select value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={statusPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{statusPlaceholder}</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {toolbarEnd && <div className="ml-auto">{toolbarEnd}</div>}
        </div>
      )}

      {!hydrated ? (
        <DataTableSkeleton />
      ) : (
        <>
          <DataTable columns={columns} rows={items} keyOf={keyOf} empty={empty} onRowClick={onRowClick} />

          {total > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {from}–{to} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
