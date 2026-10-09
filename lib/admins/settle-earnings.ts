import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import type { AdminAccount } from "@prisma/client";

export class SettleEarningsError extends Error {}

/**
 * Settles (pays out) an admin's running commission ledger, in full or in
 * part. Lifetime gross deposits are derived from the permanent transaction
 * log and are never affected by this either way — this only ever touches
 * the *unpaid* balance still owed. Records a DEPOSIT transaction either way
 * — same category as a direct balance credit — since from the account
 * holder's own transaction history this reads the same way: the superadmin
 * paid them money.
 *
 * Shared by the single-admin settle route and the "settle all" bulk route.
 */
export async function settleEarnings(
  adminId: string,
  performedByAdminId: string,
  amountMinor?: number
): Promise<AdminAccount> {
  const target = await db.adminAccount.findUnique({ where: { id: adminId } });
  if (!target) throw new SettleEarningsError("Admin not found.");

  const isPartial = amountMinor !== undefined;
  const settledMinor = isPartial ? amountMinor! : target.earningsMinor;

  if (settledMinor === 0) throw new SettleEarningsError("There's nothing unpaid to settle.");
  if (isPartial && settledMinor > target.earningsMinor) {
    throw new SettleEarningsError("That's more than this admin's unpaid earnings.");
  }

  const updated = await db.adminAccount.update({
    where: { id: adminId },
    data: isPartial ? { earningsMinor: { decrement: settledMinor } } : { earningsMinor: 0 },
  });

  await db.transaction.create({
    data: {
      accountId: adminId,
      accountKind: "ADMIN",
      type: "DEPOSIT",
      status: "SUCCESS",
      amountMinor: settledMinor,
      method: "Superadmin earnings settlement",
      phone: target.phone,
      reference: `settle_${nanoid(16)}`,
      performedByAdminId,
      note: isPartial ? "Partial earnings settlement" : "Full earnings settlement",
    },
  });

  return updated;
}
