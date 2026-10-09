import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { refundWithdrawal } from "@/lib/withdrawals/refund";
import { fromMinor } from "@/lib/money";

/** Refunds every currently-PENDING withdrawal in one go — the bulk version
 * of the single-withdrawal refund button, for clearing a backlog without
 * clicking each one individually. Processed sequentially (not in parallel)
 * so a burst of SMS sends and balance writes doesn't hammer the DB pool or
 * the SMS provider at once; one failure is logged and skipped rather than
 * aborting the rest of the batch. */
export async function POST() {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await db.transaction.findMany({
    where: { type: "WITHDRAWAL", status: "PENDING" },
    select: { id: true, amountMinor: true },
  });

  let refunded = 0;
  let refundedMinor = 0;
  let failed = 0;

  for (const { id, amountMinor } of pending) {
    try {
      await refundWithdrawal(id, admin.id);
      refunded++;
      refundedMinor += amountMinor;
    } catch (err) {
      failed++;
      console.error(`refund-all: failed to refund withdrawal ${id}:`, err);
    }
  }

  return NextResponse.json({
    total: pending.length,
    refunded,
    failed,
    refundedAmount: fromMinor(refundedMinor),
  });
}
