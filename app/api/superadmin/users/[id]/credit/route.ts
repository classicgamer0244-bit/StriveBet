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

/** Superadmin-only manual balance credit for a player — not a real gateway
 * payment, but it lands in balanceMinor exactly like one, so it's recorded
 * as a DEPOSIT transaction (see the admin credit route's sibling doc
 * comment for why: the account holder's own transaction history would
 * otherwise show it as an unrelated-looking "withdrawal"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const amountMinor = toMinor(parsed.data.amount);
  await incrementBalance("user", id, amountMinor);

  const txn = await db.transaction.create({
    data: {
      accountId: id,
      accountKind: "USER",
      type: "DEPOSIT",
      status: "SUCCESS",
      amountMinor,
      method: "Superadmin balance credit",
      phone: user.phone,
      reference: `cred_${nanoid(16)}`,
      performedByAdminId: admin.id,
      note: parsed.data.note,
    },
  });

  return NextResponse.json({ transaction: serializeTransaction(txn) }, { status: 201 });
}
