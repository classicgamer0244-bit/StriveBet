"use client";

import { useCallback, useEffect, useState } from "react";

interface UseServerTableOptions {
  /** e.g. "/api/superadmin/users" — page/pageSize/search/status are appended automatically. */
  endpoint: string;
  pageSize?: number;
  /** Extra fixed query params, e.g. { type: "deposit" }. Falsy values are omitted. */
  extraParams?: Record<string, string | undefined>;
  /** Set false for lists too small to bother with a search box (status filter still applies). */
  searchable?: boolean;
  debounceMs?: number;
}

/** Owns page/search/status state and fetches a `{items,total}` page on any
 * change — the shared fetch pattern behind every paginated admin/superadmin
 * list, so each page only wires up columns, not fetch boilerplate. */
export function useServerTable<T>({
  endpoint,
  pageSize = 20,
  extraParams,
  searchable = true,
  debounceMs = 300,
}: UseServerTableOptions) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  // "YYYY-MM-DD" (native <input type="date"> value), inclusive whole-day
  // range — see lib/pagination.ts's dateRangeFilter(), which every endpoint
  // that accepts these two params applies the same way.
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!searchable) return;
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs, searchable]);

  // Reset to page 1 whenever the filters change, adjusted during render
  // (React's documented pattern for this) rather than via a follow-up effect.
  const [appliedFilters, setAppliedFilters] = useState({ debouncedSearch, status, from, to });
  if (
    appliedFilters.debouncedSearch !== debouncedSearch ||
    appliedFilters.status !== status ||
    appliedFilters.from !== from ||
    appliedFilters.to !== to
  ) {
    setAppliedFilters({ debouncedSearch, status, from, to });
    setPage(1);
  }

  const extraParamsKey = JSON.stringify(extraParams ?? {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      for (const [key, value] of Object.entries(extraParams ?? {})) {
        if (value) params.set(key, value);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      setItems(res.ok ? (data?.items ?? []) : []);
      setTotal(res.ok ? (data?.total ?? 0) : 0);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // extraParamsKey stands in for extraParams (a fresh object identity each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, debouncedSearch, status, from, to, tick, extraParamsKey]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    items,
    total,
    page,
    setPage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    search,
    setSearch,
    status,
    setStatus,
    from,
    setFrom,
    to,
    setTo,
    hydrated,
    refresh,
  };
}
