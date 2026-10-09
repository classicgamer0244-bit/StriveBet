import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { fromMinor } from "@/lib/money";

export async function GET() {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [myUsersCount, depositsAgg, depositsTodayAgg, bets, myMatches] = await Promise.all([
    db.user.count({ where: { referredById: admin.id } }),
    // SUCCESS only — a PENDING or FAILED deposit never actually landed in the
    // player's balance, so counting it here overstated "their deposits".
    // performedByAdminId unset excludes superadmin manual balance credits —
    // those are DEPOSIT-typed too now (see .../credit/route.ts) so they show
    // correctly in the account holder's own transaction history, but they
    // never touched a real payment gateway, so they don't belong in a
    // real-money deposit-volume figure.
    db.transaction.aggregate({
      where: {
        type: "DEPOSIT",
        status: "SUCCESS",
        referringAdminId: admin.id,
        OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.transaction.aggregate({
      where: {
        type: "DEPOSIT",
        status: "SUCCESS",
        referringAdminId: admin.id,
        createdAt: { gte: startOfToday },
        OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.bet.aggregate({
      where: { referringAdminId: admin.id, placedAt: { gte: startOfToday } },
      _sum: { stakeMinor: true },
      _count: { _all: true },
    }),
    db.adminFixture.findMany({ where: { ownerAdminId: admin.id } }),
  ]);

  const liveCount = myMatches.filter((f) => f.status === "LIVE" || f.status === "HALFTIME").length;

  return NextResponse.json({
    myUsersCount,
    depositsTotal: fromMinor(depositsAgg._sum.amountMinor ?? 0),
    depositsCount: depositsAgg._count._all,
    depositsTodayTotal: fromMinor(depositsTodayAgg._sum.amountMinor ?? 0),
    depositsTodayCount: depositsTodayAgg._count._all,
    earnings: fromMinor(admin.earningsMinor),
    stakedToday: fromMinor(Number(bets._sum.stakeMinor ?? BigInt(0))),
    betsCount: bets._count._all,
    myMatchesCount: myMatches.length,
    liveCount,
  });
}
