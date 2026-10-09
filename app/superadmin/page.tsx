"use client";

import { useEffect, useState } from "react";
import { Users, Store, ArrowDownToLine, CalendarClock, Wallet, Trophy, Coins } from "lucide-react";
import { OperatorPageHeader } from "@/components/admin/operator-page";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { StatGridSkeleton } from "@/components/admin/stat-grid-skeleton";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import { money } from "@/lib/format-money";
import { SUPERADMIN_COMMISSION_SHARE } from "@/lib/constants";

interface SuperadminOverview {
  playersCount: number;
  merchantsCount: number;
  pendingCount: number;
  depositsTotal: number;
  depositsCount: number;
  depositsTodayTotal: number;
  depositsTodayCount: number;
  earnings: number;
  stakedToday: number;
  betsCount: number;
  matchesCount: number;
  liveCount: number;
}

export default function SuperadminOverviewPage() {
  const [overview, setOverview] = useState<SuperadminOverview | null>(null);

  async function load() {
    const res = await fetch("/api/superadmin/overview", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok) setOverview(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/superadmin/overview", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!cancelled && res.ok) setOverview(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PullToRefresh onRefresh={load}>
      <div>
        <OperatorPageHeader title="Overview" description="Platform-wide performance and activity." />
        {overview ? (
          <StatGrid>
            <StatCard label="Players" value={String(overview.playersCount)} icon={Users} />
            <StatCard label="Merchants" value={String(overview.merchantsCount)} sub={`${overview.pendingCount} pending approval`} icon={Store} />
            <StatCard label="Total deposits" value={money(overview.depositsTotal)} sub={`${overview.depositsCount} deposits`} icon={ArrowDownToLine} />
            <StatCard label="Deposits today" value={money(overview.depositsTodayTotal)} sub={`${overview.depositsTodayCount} deposits`} icon={CalendarClock} />
            <StatCard label={`My earnings (${Math.round(SUPERADMIN_COMMISSION_SHARE * 100)}%)`} value={money(overview.earnings)} accent="success" icon={Wallet} />
            <StatCard label="Staked today" value={money(overview.stakedToday)} sub={`${overview.betsCount} bets`} icon={Coins} />
            <StatCard label="Matches" value={String(overview.matchesCount)} sub={`${overview.liveCount} live now`} icon={Trophy} />
          </StatGrid>
        ) : (
          <StatGridSkeleton cards={7} />
        )}
      </div>
    </PullToRefresh>
  );
}
