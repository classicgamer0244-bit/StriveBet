import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";
import { parsePageParams, paginate } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, status } = parsePageParams(searchParams);

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status === "active" || status === "suspended") {
    where.status = status.toUpperCase() as "ACTIVE" | "SUSPENDED";
  }

  const result = await paginate({
    page,
    pageSize,
    count: () => db.user.count({ where }),
    findMany: (args) => db.user.findMany({ where, orderBy: { createdAt: "desc" }, ...args }),
  });

  const userIds = result.items.map((u) => u.id);
  // performedByAdminId unset excludes superadmin manual balance credits —
  // DEPOSIT-typed too now, but not a real gateway deposit (see the
  // admin/superadmin overview routes' identical exclusion).
  const depositCounts = await db.transaction.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: userIds },
      type: "DEPOSIT",
      status: "SUCCESS",
      OR: [{ performedByAdminId: null }, { performedByAdminId: { isSet: false } }],
    },
    _count: { _all: true },
  });
  const depositCountById = new Map(depositCounts.map((d) => [d.accountId, d._count._all]));

  const referrerIds = [...new Set(result.items.map((u) => u.referredById).filter((id): id is string => Boolean(id)))];
  const referrers = referrerIds.length ? await db.adminAccount.findMany({ where: { id: { in: referrerIds } } }) : [];
  const referrerNameById = new Map(referrers.map((a) => [a.id, a.displayName]));

  return NextResponse.json({
    items: result.items.map((u) => ({
      ...serializeUser(u),
      depositCount: depositCountById.get(u.id) ?? 0,
      referrerName: u.referredById ? (referrerNameById.get(u.referredById) ?? "—") : "Direct",
    })),
    total: result.total,
  });
}
