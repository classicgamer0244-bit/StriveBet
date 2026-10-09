"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ArrowDownToLine,
  CalendarClock,
  Wallet,
  Trophy,
  Coins,
  Camera,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  BadgePercent,
  Receipt,
} from "lucide-react";
import { OperatorPageHeader, OperatorPanel } from "@/components/admin/operator-page";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { StatGridSkeleton } from "@/components/admin/stat-grid-skeleton";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScreenshotBalanceModal } from "@/components/admin/screenshot-balance-modal";
import { money, shortDateTime } from "@/lib/format-money";
import { ADMIN_COMMISSION_SHARE } from "@/lib/constants";

interface SettlementItem {
  id: string;
  amount: number;
  reference: string;
  method: string;
  note: string;
  createdAt: string;
  status: string;
}

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
  settledTotal: number;
  settledCount: number;
  recentSettlements: SettlementItem[];
  balance: number;
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const commissionPercent = Math.round(ADMIN_COMMISSION_SHARE * 100);
  const lifetimeCommission = overview ? overview.settledTotal + overview.earnings : 0;

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-6">
        <OperatorPageHeader
          title="Overview"
          description="Your merchant performance & official superadmin settlement deal."
          action={
            <Button
              onClick={() => setScreenshotModalOpen(true)}
              className="gap-2 bg-volt font-bold text-navy hover:bg-volt/85 shadow-sm"
            >
              <Camera className="size-4" />
              <span>Set Screenshot Balance</span>
            </Button>
          }
        />

        {overview ? (
          <>
            {/* Main Stats Grid */}
            <StatGrid>
              <StatCard label="My users" value={String(overview.myUsersCount)} icon={Users} />
              <StatCard
                label="Their deposits"
                value={money(overview.depositsTotal)}
                sub={`${overview.depositsCount} deposits`}
                icon={ArrowDownToLine}
              />
              <StatCard
                label="Deposits today"
                value={money(overview.depositsTodayTotal)}
                sub={`${overview.depositsTodayCount} deposits`}
                icon={CalendarClock}
              />
              <StatCard
                label={`Pending commission (${commissionPercent}%)`}
                value={money(overview.earnings)}
                accent="primary"
                sub="Awaiting HQ settlement"
                icon={Clock}
              />
              <StatCard
                label="Real settled by superadmin"
                value={money(overview.settledTotal)}
                accent="success"
                sub={`${overview.settledCount} official settlement${overview.settledCount === 1 ? "" : "s"}`}
                icon={CheckCircle2}
              />
              <StatCard
                label="Screenshot balance"
                value={money(overview.balance)}
                sub="Custom display amount"
                icon={Camera}
              />
              <StatCard
                label="Staked today"
                value={money(overview.stakedToday)}
                sub={`${overview.betsCount} bets`}
                icon={Coins}
              />
              <StatCard
                label="My matches"
                value={String(overview.myMatchesCount)}
                sub={`${overview.liveCount} live now`}
                icon={Trophy}
              />
            </StatGrid>

            {/* Real Settlement Deal Section */}
            <OperatorPanel>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-foreground">
                        Superadmin Settlement Deal & Real Money Ledger
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Authentic platform payouts and commission records issued by StriveBet Superadmin HQ.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold gap-1.5 py-1 px-2.5">
                    <CheckCircle2 className="size-3.5" />
                    Real Settlement Deal: {commissionPercent}% Net
                  </Badge>
                </div>

                {/* Deal Breakdown Banner */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-border bg-muted/40 p-3.5">
                  <div className="flex flex-col gap-1 border-b border-border/50 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Wallet className="size-3 text-emerald-400" />
                      Total Settled by Superadmin
                    </span>
                    <span className="text-xl font-extrabold text-emerald-400 tabular-nums">
                      {money(overview.settledTotal)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Real money settled & paid out
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border-b border-border/50 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Clock className="size-3 text-primary" />
                      Pending Settlement (Unpaid)
                    </span>
                    <span className="text-xl font-extrabold text-primary tabular-nums">
                      {money(overview.earnings)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Accrued commission ready for payout
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <BadgePercent className="size-3 text-volt" />
                      Lifetime Commission Deal
                    </span>
                    <span className="text-xl font-extrabold text-foreground tabular-nums">
                      {money(lifetimeCommission)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      70% share of total referred deposits
                    </span>
                  </div>
                </div>

                {/* Recent Settlements List */}
                <div className="mt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Receipt className="size-3.5" />
                      Official Settlement History from HQ
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {overview.recentSettlements.length} recorded
                    </span>
                  </div>

                  {overview.recentSettlements.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <Receipt className="mx-auto size-7 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No settlements recorded yet</p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                        Commission earnings accrue automatically as your referred players deposit.
                        When Superadmin HQ executes a payout from the management portal, the verified settlement receipt and funds will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/60 font-semibold text-muted-foreground">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Reference</th>
                            <th className="p-2.5">Method / Note</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 text-right">Settled Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {overview.recentSettlements.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/30">
                              <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                                {shortDateTime(s.createdAt)}
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-foreground">
                                {s.reference}
                              </td>
                              <td className="p-2.5">
                                <span className="font-medium text-foreground">{s.method}</span>
                                {s.note && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    {s.note}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] py-0 px-2">
                                  SETTLED
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                                +{money(s.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </OperatorPanel>
          </>
        ) : (
          <StatGridSkeleton cards={8} />
        )}

        {/* Screenshot Balance Modal */}
        <ScreenshotBalanceModal
          open={screenshotModalOpen}
          onOpenChange={setScreenshotModalOpen}
          currentBalance={overview?.balance ?? 0}
          onSuccess={(newBal) => {
            if (overview) {
              setOverview({ ...overview, balance: newBal });
            }
          }}
        />
      </div>
    </PullToRefresh>
  );
}
