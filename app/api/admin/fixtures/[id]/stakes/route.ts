import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeBet } from "@/lib/bets/serialize";
import { parsePageParams, paginate } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

const STATUS_MAP: Record<string, "OPEN" | "WON" | "LOST" | "VOID" | "CASHED_OUT"> = {
  open: "OPEN",
  won: "WON",
  lost: "LOST",
  void: "VOID",
  cashed_out: "CASHED_OUT",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, status } = parsePageParams(searchParams);

  const where: Prisma.BetWhereInput = { legs: { some: { fixtureId: id } } };
  if (status && STATUS_MAP[status]) where.status = STATUS_MAP[status];

  const paged = await paginate({
    page,
    pageSize,
    count: () => db.bet.count({ where }),
    findMany: (args) => db.bet.findMany({ where, orderBy: { placedAt: "desc" }, ...args }),
  });

  const userIds = [...new Set(paged.items.filter((b) => b.accountKind === "USER").map((b) => b.accountId))];
  const adminIds = [...new Set(paged.items.filter((b) => b.accountKind === "ADMIN").map((b) => b.accountId))];
  const [users, admins] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } } }) : Promise.resolve([]),
    adminIds.length ? db.adminAccount.findMany({ where: { id: { in: adminIds } } }) : Promise.resolve([]),
  ]);
  const userLabel = new Map<string, string>();
  for (const u of users) userLabel.set(u.id, `${u.firstName} ${u.lastName}`.trim() || u.phone);
  for (const a of admins) userLabel.set(a.id, `${a.displayName} (${a.role === "SUPERADMIN" ? "Superadmin" : "Admin"})`);

  return NextResponse.json({
    items: paged.items.map((b) => ({ ...serializeBet(b), userLabel: userLabel.get(b.accountId) ?? b.accountId })),
    total: paged.total,
  });
}
