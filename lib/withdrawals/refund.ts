import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { incrementBalance, registerWithdrawalRefund } from "@/lib/accounts/balance";
import { toArkeselNumber, sendSms } from "@/lib/arkesel";
import { fromMinor } from "@/lib/money";
import type { Transaction } from "@prisma/client";

export class WithdrawalRefundError extends Error {}

/** Reverses a withdrawal that failed to pay out — credits the amount back to
 * the user's balance and marks the transaction failed (there's no separate
 * "refunded" status; failed is the terminal state a reversed withdrawal ends
 * up in). Also resets the account's deposits-since-reset counter to 0, and
 * every 2nd refund in a row flags it as needing an 8%-of-balance deposit
 * before it can withdraw again — see lib/accounts/balance.ts's
 * registerWithdrawalRefund.
 *
 * Shared by both the single-withdrawal refund route and the "refund all"
 * bulk route, so both go through the exact same balance/audit/SMS logic.
 */
export async function refundWithdrawal(transactionId: string, performedByAdminId: string): Promise<Transaction> {
  const { count } = await db.transaction.updateMany({
    where: { id: transactionId, type: "WITHDRAWAL", status: { not: "FAILED" } },
    data: { status: "FAILED" },
  });
  if (count === 0) throw new WithdrawalRefundError("That withdrawal can't be refunded.");

  const txn = await db.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  const accountKind = txn.accountKind === "ADMIN" ? "admin" : "user";
  await incrementBalance(accountKind, txn.accountId, txn.amountMinor);
  await registerWithdrawalRefund(accountKind, txn.accountId);

  const account = txn.accountKind === "USER"
    ? await db.user.findUnique({ where: { id: txn.accountId }, select: { phone: true, countryCode: true } })
    : await db.adminAccount.findUnique({ where: { id: txn.accountId }, select: { phone: true } });

  // Audit-trail only — the balance credit above already landed, so a
  // failure here must never undo it or block the response.
  try {
    await db.transaction.create({
      data: {
        accountId: txn.accountId,
        accountKind: txn.accountKind,
        type: "REFUND",
        status: "SUCCESS",
        amountMinor: txn.amountMinor,
        method: "Withdrawal refund",
        phone: account?.phone ?? txn.phone,
        reference: `refund_${nanoid(16)}`,
        referringAdminId: txn.referringAdminId ?? undefined,
        performedByAdminId,
        note: `Refund of failed withdrawal ${txn.id}`,
      },
    });
  } catch (err) {
    console.error(`failed to record REFUND transaction for withdrawal ${txn.id}:`, err);
  }

  // Send refund notification SMS — best-effort, must never break the refund.
  try {
    if (account?.phone) {
      const intlPhone = toArkeselNumber(account.phone, (account as { countryCode?: string }).countryCode ?? "233");
      const amount = fromMinor(txn.amountMinor).toFixed(2);
      await sendSms(intlPhone, `StriveBet: Your withdrawal of GHS ${amount} has been refunded. The amount has been returned to your balance.`);
    }
  } catch { /* SMS failure must never break the refund flow */ }

  return txn;
}
