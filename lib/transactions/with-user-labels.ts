import { db } from "@/lib/db";
import { serializeTransaction } from "./serialize";
import type { Transaction as PrismaTransaction } from "@prisma/client";

/** Attaches a resolved player display name to each transaction — used by the
 * admin/superadmin dashboards only; the player's own /api/transactions has
 * no need for it (it's always "me"). Transactions can belong to either a
 * User or an AdminAccount (staff can now bet/deposit/withdraw too), so both
 * collections are queried and merged into one label map. */
export async function serializeTransactionsWithUserLabels(transactions: PrismaTransaction[]) {
  const userIds = [...new Set(transactions.filter((t) => t.accountKind === "USER").map((t) => t.accountId))];
  const adminIds = [...new Set(transactions.filter((t) => t.accountKind === "ADMIN").map((t) => t.accountId))];

  const [users, admins] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } } }) : Promise.resolve([]),
    adminIds.length ? db.adminAccount.findMany({ where: { id: { in: adminIds } } }) : Promise.resolve([]),
  ]);

  const labelById = new Map<string, string>();
  for (const u of users) labelById.set(u.id, `${u.firstName} ${u.lastName}`.trim() || u.phone);
  for (const a of admins) labelById.set(a.id, `${a.displayName} (${a.role === "SUPERADMIN" ? "Superadmin" : "Admin"})`);

  return transactions.map((t) => ({ ...serializeTransaction(t), userLabel: labelById.get(t.accountId) ?? t.accountId }));
}
