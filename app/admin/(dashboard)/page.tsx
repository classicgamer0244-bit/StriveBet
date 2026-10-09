"use client";

import { useEffect, useState } from "react";
import { Users, ArrowDownToLine, CalendarClock, Wallet, Trophy, Coins } from "lucide-react";
import { OperatorPageHeader } from "@/components/admin/operator-page";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { StatGridSkeleton } from "@/components/admin/stat-grid-skeleton";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import { money } from "@/lib/format-money";
import { ADMIN_COMMISSION_SHARE } from "@/lib/constants";

interface AdminOverview {
  myUsersCount: number;
  depositsTotal: number;
  depositsCount: number;
  depositsTodayTotal: number;
  depositsTodayCount: number;
  earnings: number;
  stakedToday: number;
  betsCount: number;
  myMatchesCount: number;
  liveCount: number;
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  async function load() {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok) setOverview(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!cancelled && res.ok) setOverview(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PullToRefresh onRefresh={load}>
      <div>
        <OperatorPageHeader title="Overview" description="Your merchant performance at a glance." />
        {overview ? (
          <StatGrid>
            <StatCard label="My users" value={String(overview.myUsersCount)} icon={Users} />
            <StatCard label="Their deposits" value={money(overview.depositsTotal)} sub={`${overview.depositsCount} deposits`} icon={ArrowDownToLine} />
            <StatCard
              label="Deposits today"
              value={money(overview.depositsTodayTotal)}
              sub={`${overview.depositsTodayCount} deposits`}
              icon={CalendarClock}
            />
            <StatCard
              label={`My earnings (${Math.round(ADMIN_COMMISSION_SHARE * 100)}%)`}
              value={money(overview.earnings)}
              accent="success"
              icon={Wallet}
            />
            <StatCard label="Staked today" value={money(overview.stakedToday)} sub={`${overview.betsCount} bets`} icon={Coins} />
            <StatCard label="My matches" value={String(overview.myMatchesCount)} sub={`${overview.liveCount} live now`} icon={Trophy} />
          </StatGrid>
        ) : (
          <StatGridSkeleton cards={6} />
        )}
      </div>
    </PullToRefresh>
  );
}
