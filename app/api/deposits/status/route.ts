import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { checkPaymentStatus, gatewayRefFrom, toTransactionStatus } from "@/lib/payments-service";
import { creditSuccessfulDeposit, markFailedDeposit } from "@/lib/deposits/credit";

/** How long to let a PENDING row sit untouched before this route starts
 * proactively polling the payments service itself — the very first poll or two
 * happens before the customer has even finished paying in the modal, so calling
 * out immediately would just waste a request. */
const SELF_HEAL_AFTER_MS = 10_000;

/**
 * Polling target for the deposit page while it waits for the customer to
 * complete the Flutterwave modal. Self-heals by asking the payments service for
 * the authoritative status (the same "verify, don't trust" independent check
 * the webhook uses) so the balance still lands correctly even if the webhook is
 * slow, dropped, or never arrives.
 */
export async function GET(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Log in to check deposit status." }, { status: 401 });

  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return NextResponse.json({ error: "Missing reference." }, { status: 400 });

  const txn = await db.transaction.findUnique({ where: { reference } });
  if (!txn || txn.type !== "DEPOSIT" || txn.accountId !== account.id) {
    return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
  }

  if (txn.status === "PENDING" && Date.now() - txn.createdAt.getTime() >= SELF_HEAL_AFTER_MS) {
    try {
      // The amount is passed so the service can run the full four checks
      // against what WE recorded, not what the gateway reports in isolation.
      const result = await checkPaymentStatus(reference, txn.amountMinor, gatewayRefFrom(txn));
      const mapped = toTransactionStatus(result.status);
      if (mapped === "SUCCESS") await creditSuccessfulDeposit(reference, result.raw);
      else if (mapped === "FAILED") await markFailedDeposit(reference, result.raw);

      if (result.transactionId && !txn.gatewayTransactionId) {
        await db.transaction.update({
          where: { reference },
          data: { gatewayTransactionId: String(result.transactionId) },
        });
      }
    } catch (err) {
      console.error("Payments service status self-heal check failed:", err);
      // Fall through and report whatever status we already had — the
      // frontend keeps polling, the next attempt tries again.
    }
  }

  const latest = await db.transaction.findUnique({ where: { reference }, select: { status: true } });
  return NextResponse.json({ status: latest?.status ?? txn.status });
}
