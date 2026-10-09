import { db } from "@/lib/db";
import { ADMIN_COMMISSION_SHARE } from "@/lib/constants";
import { incrementBalance, recordSuccessfulDeposit } from "@/lib/accounts/balance";
import { toArkeselNumber, sendSms } from "@/lib/arkesel";
import { fromMinor } from "@/lib/money";
import type { Prisma } from "@prisma/client";

/**
 * Credits a successful deposit: full amount to the user's balance, plus the
 * 70/30 admin/superadmin commission split, taken directly off the full
 * deposit amount (remainder-based rounding — superadmin gets the deposit
 * minus the admin's rounded share — avoids drift). If nobody referred this
 * account, the superadmin gets the entire deposit as their commission, same
 * as before. Called from both the status-poll self-heal path and the
 * forwarded payments webhook — whichever arrives first should win, the other should
 * no-op.
 *
 * The transition uses `updateMany` filtered on the transaction NOT already
 * being SUCCESS, rather than a naive findUnique-then-update, so it's atomic:
 * if the poll and webhook land at the same moment, only one of them gets a
 * nonzero `count` back and actually credits the balance.
 *
 * A FAILED row is recoverable on purpose — see the comment on the update.
 */
export async function creditSuccessfulDeposit(reference: string, gatewayRaw?: unknown): Promise<void> {
  const txn = await db.transaction.findUnique({ where: { reference } });
  if (!txn || txn.type !== "DEPOSIT") return;

  let adminCommissionMinor: number | undefined;
  let superadminCommissionMinor: number | undefined;
  if (txn.referringAdminId) {
    adminCommissionMinor = Math.round(txn.amountMinor * ADMIN_COMMISSION_SHARE);
    superadminCommissionMinor = txn.amountMinor - adminCommissionMinor;
  } else {
    superadminCommissionMinor = txn.amountMinor;
  }

  // PENDING *or* FAILED. Recovering a FAILED row matters: a deposit that the
  // gateway later confirms — because a status check timed out, or an earlier
  // check wrongly closed it — was never credited, so crediting it now is
  // correct rather than a double-credit. Only a SUCCESS row is excluded, and
  // the atomic updateMany still guarantees exactly one caller wins the race.
  const { count } = await db.transaction.updateMany({
    where: { reference, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "SUCCESS",
      adminCommissionMinor,
      superadminCommissionMinor,
      ...(gatewayRaw !== undefined ? { gatewayRaw: gatewayRaw as Prisma.InputJsonValue } : {}),
    },
  });
  if (count === 0) return; // already credited by another path (webhook vs poll vs sweep)

  if (txn.status === "FAILED") {
    console.warn(
      `[deposits] Recovered a deposit that was previously marked FAILED: ${reference} ` +
        `(${txn.amountMinor} minor). The gateway confirms it succeeded.`
    );
  }

  const accountKind = txn.accountKind === "ADMIN" ? "admin" : "user";
  // Must run before incrementBalance — it checks this deposit's size against
  // the balance as it stood BEFORE this deposit, not after.
  await recordSuccessfulDeposit(accountKind, txn.accountId, txn.amountMinor);
  await incrementBalance(accountKind, txn.accountId, txn.amountMinor);

  // Send deposit confirmation SMS
  try {
    const user = txn.accountKind === "USER"
      ? await db.user.findUnique({ where: { id: txn.accountId }, select: { phone: true, countryCode: true } })
      : await db.adminAccount.findUnique({ where: { id: txn.accountId }, select: { phone: true } });
    if (user?.phone) {
      const intlPhone = toArkeselNumber(user.phone, (user as { countryCode?: string }).countryCode ?? "233");
      const amount = fromMinor(txn.amountMinor).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await sendSms(intlPhone, `StriveBet: Your deposit of GHS ${amount} was successful. Your balance has been updated. Thank you!`);
    }
  } catch { /* SMS failure must never break the deposit flow */ }

  if (txn.referringAdminId && adminCommissionMinor) {
    await db.adminAccount.update({
      where: { id: txn.referringAdminId },
      data: { earningsMinor: { increment: adminCommissionMinor } },
    });
  }
  if (superadminCommissionMinor) {
    const superadmin = await db.adminAccount.findFirst({ where: { role: "SUPERADMIN" } });
    if (superadmin) {
      await db.adminAccount.update({
        where: { id: superadmin.id },
        data: { earningsMinor: { increment: superadminCommissionMinor } },
      });
    }
  }
}

/**
 * Mirrors creditSuccessfulDeposit's PENDING-guarded atomicity, but for
 * the gateway's other terminal state. The collection flow is async (the
 * charge is submitted, then the customer approves on their phone later), so
 * unlike Paystack's old synchronous-verify callback, a genuine FAILED status
 * is available here — worth recording so the frontend's poll loop can stop
 * immediately instead of waiting out its full timeout.
 */
export async function markFailedDeposit(reference: string, gatewayRaw?: unknown): Promise<void> {
  await db.transaction.updateMany({
    where: { reference, status: "PENDING" },
    data: {
      status: "FAILED",
      ...(gatewayRaw !== undefined ? { gatewayRaw: gatewayRaw as Prisma.InputJsonValue } : {}),
    },
  });
}
