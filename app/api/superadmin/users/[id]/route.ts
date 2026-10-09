import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";
import { fromMinor } from "@/lib/money";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [depositsAgg, betsAgg, referrer] = await Promise.all([
    db.transaction.aggregate({
      where: {
        accountId: id,
        type: "DEPOSIT",
        status: "SUCCESS",
        OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.bet.aggregate({
      where: { accountId: id },
      _sum: { stakeMinor: true },
      _count: { _all: true },
    }),
    user.referredById ? db.adminAccount.findUnique({ where: { id: user.referredById }, select: { displayName: true } }) : null,
  ]);

  return NextResponse.json({
    user: { ...serializeUser(user), referrerName: referrer?.displayName ?? null },
    totalDeposited: fromMinor(depositsAgg._sum.amountMinor ?? 0),
    depositCount: depositsAgg._count._all,
    totalStaked: fromMinor(Number(betsAgg._sum.stakeMinor ?? BigInt(0))),
    betCount: betsAgg._count._all,
  });
}
