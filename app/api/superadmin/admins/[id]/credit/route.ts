import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { incrementBalance } from "@/lib/accounts/balance";
import { serializeTransaction } from "@/lib/transactions/serialize";
import { toMinor } from "@/lib/money";

const bodySchema = z.object({
  amount: z.number().positive(),
  note: z.string().trim().max(200).optional(),
});

/** Superadmin-only manual balance credit for an admin/superadmin's own betting
 * wallet (balanceMinor) — separate from earningsMinor (referral commission).
 * Recorded as a DEPOSIT: it lands in balanceMinor exactly like a real gateway
 * deposit does, so the account holder's own transaction history shows it the
 * same way rather than as an unrelated-looking "withdrawal" (the old
 * ADJUSTMENT type fell into that bucket on the account holder's simplified
 * view — see components/account/my-transactions-list.tsx). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superadmin = await requireAdmin("SUPERADMIN");
  if (!superadmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const target = await db.adminAccount.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  const amountMinor = toMinor(parsed.data.amount);
  await incrementBalance("admin", id, amountMinor);

  const txn = await db.transaction.create({
    data: {
      accountId: id,
      accountKind: "ADMIN",
      type: "DEPOSIT",
      status: "SUCCESS",
      amountMinor,
      method: "Superadmin balance credit",
      phone: target.phone,
      reference: `cred_${nanoid(16)}`,
      performedByAdminId: superadmin.id,
      note: parsed.data.note,
    },
  });

  return NextResponse.json({ transaction: serializeTransaction(txn) }, { status: 201 });
}
