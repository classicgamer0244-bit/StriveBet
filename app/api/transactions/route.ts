import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { serializeTransaction } from "@/lib/transactions/serialize";
import { toAccountKind } from "@/lib/accounts/balance";

export async function GET(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const base = { accountId: account.id, accountKind: toAccountKind(account.kind) };
  const where =
    type === "deposit"
      ? { ...base, type: "DEPOSIT" as const }
      : type === "withdrawal"
        ? { ...base, type: "WITHDRAWAL" as const }
        : base;

  const transactions = await db.transaction.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ transactions: transactions.map(serializeTransaction) });
}
