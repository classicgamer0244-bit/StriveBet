import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { settleEarnings } from "@/lib/admins/settle-earnings";
import { fromMinor } from "@/lib/money";

/** Settles every admin's unpaid commission ledger in one pass — the bulk
 * version of the per-merchant "Settle & reset earnings" button, for paying
 * everyone out at once instead of clicking through each merchant. Processed
 * sequentially so a burst of writes doesn't hammer the DB pool; one failure
 * is logged and skipped rather than aborting the rest of the batch. */
export async function POST() {
  const superadmin = await requireAdmin("SUPERADMIN");
  if (!superadmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ADMIN only — the superadmin's own earnings ledger is a different concept
  // with its own clear action (.../settings/reset), which deliberately
  // writes no payout transaction since nobody pays themselves.
  const owed = await db.adminAccount.findMany({
    where: { role: "ADMIN", earningsMinor: { gt: 0 } },
    select: { id: true, earningsMinor: true },
  });

  let settled = 0;
  let settledMinor = 0;
  let failed = 0;

  for (const { id, earningsMinor } of owed) {
    try {
      await settleEarnings(id, superadmin.id);
      settled++;
      settledMinor += earningsMinor;
    } catch (err) {
      failed++;
      console.error(`settle-all-earnings: failed to settle admin ${id}:`, err);
    }
  }

  return NextResponse.json({
    total: owed.length,
    settled,
    failed,
    settledAmount: fromMinor(settledMinor),
  });
}
