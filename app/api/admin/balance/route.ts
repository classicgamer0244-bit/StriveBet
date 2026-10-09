import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toMinor, fromMinor } from "@/lib/money";

const bodySchema = z.object({
  amount: z.number().min(0, "Amount must be 0 or greater").max(1_000_000_000, "Amount is too large"),
});

export async function GET() {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    balance: fromMinor(account.balanceMinor),
  });
}

export async function POST(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Please enter a valid amount.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const amountMinor = toMinor(parsed.data.amount);

  if (account.kind === "user") {
    await db.user.update({
      where: { id: account.id },
      data: { balanceMinor: amountMinor },
    });
  } else {
    await db.adminAccount.update({
      where: { id: account.id },
      data: { balanceMinor: amountMinor },
    });
  }

  return NextResponse.json({
    success: true,
    balance: fromMinor(amountMinor),
  });
}
