import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { parsePageParams, paginate } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, status } = parsePageParams(searchParams);

  const where: Prisma.AdminFixtureWhereInput = {};
  if (search) {
    where.OR = [
      { homeTeamName: { contains: search, mode: "insensitive" } },
      { awayTeamName: { contains: search, mode: "insensitive" } },
      { leagueName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) {
    where.status = status.toUpperCase() as Prisma.AdminFixtureWhereInput["status"];
  }

  const result = await paginate({
    page,
    pageSize,
    count: () => db.adminFixture.count({ where }),
    findMany: (args) => db.adminFixture.findMany({ where, orderBy: { createdAt: "desc" }, ...args }),
  });

  const ownerIds = [...new Set(result.items.map((f) => f.ownerAdminId))];
  const owners = ownerIds.length
    ? await db.adminAccount.findMany({ where: { id: { in: ownerIds } }, select: { id: true, displayName: true } })
    : [];
  const ownerNameById = new Map(owners.map((o) => [o.id, o.displayName]));

  return NextResponse.json({
    items: result.items.map((f) => ({
      ...serializeAdminFixtureFull(f),
      ownerName: ownerNameById.get(f.ownerAdminId) ?? "—",
    })),
    total: result.total,
  });
}
