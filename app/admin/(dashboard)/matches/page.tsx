"use client";

import { useEffect, useState } from "react";
import { OperatorPageHeader } from "@/components/admin/operator-page";
import { MatchList } from "@/components/admin/match-list";
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton";
import type { AdminFixture } from "@/types";

export default function AdminMatchesPage() {
  const [fixtures, setFixtures] = useState<AdminFixture[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/fixtures", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        setFixtures(res.ok ? (data?.fixtures ?? []) : []);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <OperatorPageHeader title="Matches" description="Create and manage your simulated matches." />
      {hydrated ? <MatchList fixtures={fixtures} /> : <DataTableSkeleton />}
    </div>
  );
}
