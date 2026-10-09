import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toAccountKind } from "@/lib/accounts/balance";

export async function GET() {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ hasWon: false });

  const count = await db.bet.count({
    where: { accountId: account.id, accountKind: toAccountKind(account.kind), status: "WON" },
  });

  return NextResponse.json({ hasWon: count > 0 });
}
