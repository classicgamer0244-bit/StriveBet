import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/settings";
import { fromMinor } from "@/lib/money";

export async function GET() {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [settings, playersCount, merchantsCount, pendingCount, depositsAgg, depositsTodayAgg, bets, matchesCount, liveCount] = await Promise.all([
    getPlatformSettings(),
    db.user.count(),
    db.adminAccount.count({ where: { role: "ADMIN" } }),
    db.adminAccount.count({ where: { role: "ADMIN", status: "PENDING" } }),
    db.transaction.aggregate({
      where: {
        type: "DEPOSIT",
        status: "SUCCESS",
        OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.transaction.aggregate({
      where: {
        type: "DEPOSIT",
        status: "SUCCESS",
        createdAt: { gte: startOfToday },
        OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.bet.aggregate({
      where: { placedAt: { gte: startOfToday } },
      _sum: { stakeMinor: true },
      _count: { _all: true },
    }),
    db.adminFixture.count(),
    db.adminFixture.count({ where: { status: { in: ["LIVE", "HALFTIME"] } } }),
  ]);

  const resetAt = settings.depositsResetAt ?? null;

  // Re-run deposit total with the reset cutoff applied if one exists
  const depositsAggFinal = resetAt
    ? await db.transaction.aggregate({
        where: {
          type: "DEPOSIT",
          status: "SUCCESS",
          createdAt: { gte: resetAt },
          OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
        },
        _sum: { amountMinor: true },
        _count: { _all: true },
      })
    : depositsAgg;

  // Today's figure: if reset happened today, use the later of the two cutoffs
  const todayFrom = resetAt && resetAt > startOfToday ? resetAt : startOfToday;
  const depositsTodayAggFinal =
    resetAt && resetAt > startOfToday
      ? await db.transaction.aggregate({
          where: {
            type: "DEPOSIT",
            status: "SUCCESS",
            createdAt: { gte: todayFrom },
            OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
          },
          _sum: { amountMinor: true },
          _count: { _all: true },
        })
      : depositsTodayAgg;

  return NextResponse.json({
    playersCount,
    merchantsCount,
    pendingCount,
    depositsTotal: fromMinor(depositsAggFinal._sum.amountMinor ?? 0),
    depositsCount: depositsAggFinal._count._all,
    depositsTodayTotal: fromMinor(depositsTodayAggFinal._sum.amountMinor ?? 0),
    depositsTodayCount: depositsTodayAggFinal._count._all,
    earnings: fromMinor(admin.earningsMinor),
    depositsResetAt: resetAt?.toISOString() ?? null,
    stakedToday: fromMinor(Number(bets._sum.stakeMinor ?? BigInt(0))),
    betsCount: bets._count._all,
    matchesCount,
    liveCount,
  });
}
