import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { toMinor, fromMinor } from "@/lib/money";
import { serializeAdmin } from "@/lib/auth/serialize";

const bodySchema = z.object({
  amount: z.number().min(0, "Amount must be 0 or greater").max(1_000_000_000, "Amount is too large"),
});

export async function GET() {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    balance: fromMinor(admin.balanceMinor),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Please enter a valid amount.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const amountMinor = toMinor(parsed.data.amount);

  const updated = await db.adminAccount.update({
    where: { id: admin.id },
    data: { balanceMinor: amountMinor },
  });

  return NextResponse.json({
    success: true,
    balance: fromMinor(updated.balanceMinor),
    admin: serializeAdmin(updated),
  });
}
