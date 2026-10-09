import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toAccountKind } from "@/lib/accounts/balance";

const bodySchema = z.object({
  betIds: z.array(z.string()).min(1).max(50),
});

/** Marks the given wins/cashouts as shown — scoped to the caller's own bets,
 * so each one's celebration modal surfaces exactly once, ever. */
export async function POST(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { count } = await db.bet.updateMany({
    where: {
      id: { in: parsed.data.betIds },
      accountId: account.id,
      accountKind: toAccountKind(account.kind),
      status: { in: ["WON", "CASHED_OUT"] },
    },
    data: { winNotifiedAt: new Date() },
  });

  return NextResponse.json({ updated: count });
}
