import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyWebhookSignature,
  verifyShinobiWebhook,
  checkPaymentStatus,
  gatewayRefFrom,
  toTransactionStatus,
} from "@/lib/payments-service";
import { creditSuccessfulDeposit, markFailedDeposit } from "@/lib/deposits/credit";

/**
 * Payment webhook — one URL for both gateways, told apart by which signature
 * header arrives:
 *   - `X-AkwaPay-Signature` → ShinobiPay (HMAC of the RAW body, SHINOBIPAY_WEBHOOK_SECRET)
 *   - `verif-hash`          → Flutterwave (must equal FLUTTERWAVE_WEBHOOK_HASH)
 *
 * The body is read only to find our reference. The crediting decision always
 * comes from an independent checkPaymentStatus() call — the webhook is a hint
 * to go and ask, never an instruction to pay.
 *
 * Idempotent with the status-poll route and the pending-deposit sweep via
 * creditSuccessfulDeposit()/markFailedDeposit()'s atomic PENDING-guarded
 * update — whichever path lands first wins and the others no-op.
 */
export async function POST(request: Request) {
  // Raw text first: ShinobiPay signs the exact bytes, so parsing before
  // verifying would make a valid signature impossible to match.
  const rawBody = await request.text();

  const shinobiSignature = request.headers.get("x-akwapay-signature");
  let body: Record<string, any> | null = null;
  let reference: unknown;
  let gatewayName: string;

  if (shinobiSignature) {
    gatewayName = "ShinobiPay";
    if (!verifyShinobiWebhook(rawBody, shinobiSignature)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    body = safeParse(rawBody);
    // Payout/other events aren't deposits — acknowledge so they stop retrying.
    if (typeof body?.type !== "string" || !body.type.startsWith("payment_intent.")) {
      return NextResponse.json({ received: true });
    }
    reference = body?.data?.reference;
  } else {
    gatewayName = "Flutterwave";
    if (!verifyWebhookSignature(request.headers.get("verif-hash"))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    body = safeParse(rawBody);
    // Flutterwave sends `data.tx_ref` as our reference.
    reference = body?.data?.tx_ref ?? body?.txRef ?? body?.tx_ref;
  }

  if (typeof reference !== "string" || !reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  const txn = await db.transaction.findUnique({ where: { reference } });
  if (!txn || txn.type !== "DEPOSIT") {
    // 200, not 404: an unknown reference is not something retrying can fix.
    return NextResponse.json({ received: true });
  }

  try {
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
    console.error(`${gatewayName} webhook status check failed:`, err);
    // 502 so the gateway retries — the pending-deposit sweep is the backstop
    // if it never does.
    return NextResponse.json({ error: "Status check failed." }, { status: 502 });
  }

  return NextResponse.json({ received: true });
}

function safeParse(text: string): Record<string, any> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
