import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { serializeAdmin } from "@/lib/auth/serialize";
import { toMinor } from "@/lib/money";
import { settleEarnings, SettleEarningsError } from "@/lib/admins/settle-earnings";

const bodySchema = z.object({
  /** Omitted: full settle (zeroes the ledger — the original one-click
   * "paid everything out" flow). Provided: partial settle — deducts exactly
   * this much instead, for a superadmin paying a merchant out in
   * installments rather than all at once. */
  amount: z.number().positive().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superadmin = await requireAdmin("SUPERADMIN");
  if (!superadmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  try {
    const updated = await settleEarnings(
      id,
      superadmin.id,
      parsed.data.amount !== undefined ? toMinor(parsed.data.amount) : undefined
    );
    return NextResponse.json({ admin: serializeAdmin(updated) });
  } catch (err) {
    if (err instanceof SettleEarningsError) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Admin not found." ? 404 : 400 });
    }
    throw err;
  }
}
