import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { createMomoCharge, type MomoNetworkCode } from "@/lib/payments-service";

/**
 * Completes a deposit that the gateway asked to verify with a texted code.
 *
 * Separate from /initialize on purpose, and the reason is the reference. A
 * gateway requiring an OTP has already accepted the charge — it wants the SAME
 * merchant reference resubmitted with the code, not a new payment. Moolre also
 * enforces that references are unique, so minting a fresh one would be rejected
 * outright, and re-running /initialize would leave an orphaned PENDING row
 * behind on every attempt.
 *
 * So this re-charges the EXISTING reference and writes to the EXISTING row.
 */

const bodySchema = z.object({
  reference: z.string().trim().min(1),
  otp: z.string().trim().min(1).max(20),
});

/** Reverse of the labels written at initiation — the row records the human
 *  name, the gateway needs the code. */
const NETWORK_CODES: Record<string, MomoNetworkCode> = {
  "MTN Mobile Money": "MTN",
  "Telecel Cash": "VODAFONE",
  "AirtelTigo Money": "TIGO",
};

export async function POST(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return NextResponse.json({ error: "Log in to deposit." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const txn = await db.transaction.findUnique({ where: { reference: parsed.data.reference } });
  // Ownership checked explicitly: the reference is the only input, so without
  // this any logged-in player could push codes at another player's deposit.
  if (!txn || txn.type !== "DEPOSIT" || txn.accountId !== account.id) {
    return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
  }
  if (txn.status !== "PENDING") {
    return NextResponse.json({ error: "That deposit has already been completed." }, { status: 409 });
  }

  const network = NETWORK_CODES[txn.network ?? ""];
  if (!network) {
    return NextResponse.json({ error: "That deposit can't be verified with a code." }, { status: 400 });
  }

  let result;
  try {
    result = await createMomoCharge({
      reference: txn.reference,
      amountMinor: txn.amountMinor,
      network,
      phone: txn.phone,
      otp: parsed.data.otp,
      // The gateway id stored when the charge was created. Without it a gateway
      // that authorizes by id would create a SECOND charge for the same deposit.
      providerRef: txn.gatewayTransactionId,
      customer: {
        email: account.email?.trim() || `player-${account.id}@maxbet.app`,
        name: `${account.firstName} ${account.lastName}`.trim(),
      },
      metadata: { account_id: account.id, account_kind: txn.accountKind },
      clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    });
  } catch (err) {
    // Deliberately NOT failed here. We never reached the gateway, so the charge
    // it already accepted may still complete on its own — closing the row would
    // strand a payment the customer is about to make.
    console.error(`[deposits] OTP verify unreachable for ${txn.reference}:`, err);
    return NextResponse.json({ error: "Couldn't reach the payment provider. Please try again." }, { status: 502 });
  }

  console.info(`[deposits] OTP verify ${txn.reference} ok=${result.ok} raw=${JSON.stringify(result.gateway)}`);

  if (!result.ok) {
    // A wrong code is a retry, not a dead deposit — the row stays PENDING so
    // the customer can enter it again. Only the gateway explicitly declining
    // the payment closes it.
    return NextResponse.json({ error: result.error ?? "That code wasn't accepted. Please try again." }, { status: 400 });
  }

  await db.transaction.update({
    where: { reference: txn.reference },
    data: { gatewayRaw: result.gateway as Prisma.InputJsonValue },
  });

  // Still asking for a code means the one supplied was not accepted; anything
  // else means the charge moved on and the poll takes over from here.
  if (result.action === "otp_required") {
    return NextResponse.json({ error: result.instruction ?? "That code wasn't accepted. Please try again." }, { status: 400 });
  }

  return NextResponse.json({
    reference: txn.reference,
    action: result.action,
    redirectUrl: result.redirectUrl ?? null,
    instruction: result.instruction ?? null,
  });
}
