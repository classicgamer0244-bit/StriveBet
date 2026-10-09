import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { serializeTransaction } from "@/lib/transactions/serialize";
import { refundWithdrawal, WithdrawalRefundError } from "@/lib/withdrawals/refund";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const txn = await refundWithdrawal(id, admin.id);
    return NextResponse.json({ transaction: serializeTransaction(txn) });
  } catch (err) {
    if (err instanceof WithdrawalRefundError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
