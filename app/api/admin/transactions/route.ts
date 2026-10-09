import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeTransactionsWithUserLabels } from "@/lib/transactions/with-user-labels";
import { parsePageParams, paginate, dateRangeFilter } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, status, from, to } = parsePageParams(searchParams);
  const type = searchParams.get("type");

  const baseFilter: Prisma.TransactionWhereInput =
    type === "settlement"
      ? {
          accountId: admin.id,
          accountKind: "ADMIN",
          status: "SUCCESS",
          OR: [
            { method: { contains: "settlement", mode: "insensitive" } },
            { method: { contains: "Superadmin", mode: "insensitive" } },
            { performedByAdminId: { not: null } },
            { note: { contains: "settlement", mode: "insensitive" } },
          ],
        }
      : {
          OR: [{ referringAdminId: admin.id }, { accountId: admin.id, accountKind: "ADMIN" }],
        };

  const andFilters: Prisma.TransactionWhereInput[] = [baseFilter];

  if (type === "deposit") andFilters.push({ type: "DEPOSIT" });
  else if (type === "withdrawal") andFilters.push({ type: "WITHDRAWAL" });

  if (status === "pending" || status === "success" || status === "failed") {
    andFilters.push({ status: status.toUpperCase() as "PENDING" | "SUCCESS" | "FAILED" });
  }

  if (search) {
    andFilters.push({
      OR: [
        { phone: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const createdAt = dateRangeFilter(from, to);
  if (createdAt) andFilters.push({ createdAt });

  const where: Prisma.TransactionWhereInput = { AND: andFilters };

  const result = await paginate({
    page,
    pageSize,
    count: () => db.transaction.count({ where }),
    findMany: (args) => db.transaction.findMany({ where, orderBy: { createdAt: "desc" }, ...args }),
  });

  return NextResponse.json({ items: await serializeTransactionsWithUserLabels(result.items), total: result.total });
}
