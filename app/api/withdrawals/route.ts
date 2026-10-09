import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toMinor, fromMinor } from "@/lib/money";
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/constants";
import { serializeTransaction } from "@/lib/transactions/serialize";
import { decrementBalanceIfSufficient, toAccountKind } from "@/lib/accounts/balance";
import { checkWithdrawalEligibility } from "@/lib/withdrawal-eligibility";
import { toArkeselNumber, sendSms } from "@/lib/arkesel";

// Bank transfer is "coming soon" (disabled in the UI) — only Mobile Money
// withdrawals are accepted server-side too, not just hidden client-side.
const bodySchema = z.object({
  amount: z.number().positive(),
  phone: z.string().trim().min(6).max(20),
  network: z.string().trim().min(1),
});

/** Simulated — no real payout, this only deducts the balance and records the
 * transaction, per the confirmed decision. Starts PENDING, not SUCCESS — a
 * superadmin reviews and can refund it (see app/api/superadmin/withdrawals/
 * [id]/refund), which is also what drives the deposit-count/penalty rules
 * below (see lib/accounts/balance.ts's registerWithdrawalRefund). */
export async function POST(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Log in to withdraw." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const eligibility = checkWithdrawalEligibility({
    depositsSinceReset: account.depositsSinceReset,
    penaltyDepositRequired: account.penaltyDepositRequired,
    balance: fromMinor(account.balanceMinor),
    isAdmin: account.kind === "admin",
  });
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 403 });
  }

  const amountMinor = toMinor(parsed.data.amount);
  if (amountMinor < toMinor(MIN_WITHDRAWAL_AMOUNT)) {
    return NextResponse.json({ error: `Minimum withdrawal is GHS ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.` }, { status: 400 });
  }
  if (amountMinor > account.balanceMinor) {
    return NextResponse.json({ error: "Amount exceeds your available balance." }, { status: 400 });
  }

  // Atomic guard against a double-submit racing this same balance check.
  const debited = await decrementBalanceIfSufficient(account.kind, account.id, amountMinor);
  if (!debited) {
    return NextResponse.json({ error: "Amount exceeds your available balance." }, { status: 400 });
  }

  const txn = await db.transaction.create({
    data: {
      accountId: account.id,
      accountKind: toAccountKind(account.kind),
      type: "WITHDRAWAL",
      status: account.kind === "admin" ? "SUCCESS" : "PENDING",
      amountMinor,
      method: parsed.data.network,
      phone: parsed.data.phone,
      network: parsed.data.network,
      reference: `wd_${nanoid(16)}`,
      referringAdminId: account.referrerAdminId ?? undefined,
    },
  });

  // Send withdrawal confirmation SMS
  try {
    const user = account.kind === "user"
      ? await db.user.findUnique({ where: { id: account.id }, select: { phone: true, countryCode: true } })
      : null;
    const intlPhone = toArkeselNumber(account.phone, user?.countryCode ?? "233");
    const amount = fromMinor(amountMinor).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await sendSms(intlPhone, `StriveBet: Your withdrawal request of GHS ${amount} to ${parsed.data.phone} (${parsed.data.network}) has been received and is being processed.`);
  } catch { /* SMS failure must never block the response */ }

  return NextResponse.json({ transaction: serializeTransaction(txn) }, { status: 201 });
}
