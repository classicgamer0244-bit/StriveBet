import { db } from "@/lib/db";
import {
  checkPaymentStatus,
  gatewayRefFrom,
  isRetiredProviderError,
  isMismatch,
  toTransactionStatus,
  PaymentsServiceConfigError,
} from "@/lib/payments-service";
import { creditSuccessfulDeposit, markFailedDeposit } from "./credit";

/**
 * Deep reconciliation against the gateway — the fix for "the customer paid,
 * Flutterwave shows it, but MaxBet never credited them".
 *
 * ## Why the pending-deposit sweep wasn't enough
 *
 * lib/deposits/sweep.ts is a fast, frequent backstop, and it has two blind
 * spots that this pass exists to cover:
 *
 *   1. **It gives up after 24 hours.** `MAX_AGE_MS` excludes older rows, so a
 *      deposit that stayed PENDING through a bad day was abandoned silently
 *      and permanently.
 *   2. **It only looks at PENDING rows.** A deposit wrongly closed as FAILED —
 *      by a status check that mismatched, or a gateway blip — was never looked
 *      at again, even though the money had actually arrived.
 *
 * Both leave a paid deposit uncredited AND invisible in the dashboards, which
 * count `status: "SUCCESS"` only. One root cause, both reported symptoms.
 *
 * ## Why checking our own rows is complete
 *
 * We mint the `tx_ref` and write the transaction row BEFORE asking the gateway
 * for anything, so a Flutterwave payment whose reference is absent from this
 * database cannot exist. Walking our own rows therefore covers every payment —
 * no need to enumerate the gateway's side.
 *
 * Safe to run repeatedly and concurrently with the sweep: crediting goes
 * through creditSuccessfulDeposit()'s atomic guard, so whichever path lands
 * first wins and the rest no-op.
 */

/** How far back to look. Deliberately far longer than the sweep's 24h — this
 *  is the pass that catches what the sweep already gave up on. */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/** Leaves the freshest rows to the sweep and the deposit form's own poll,
 *  which resolve them faster. */
const MIN_AGE_MS = 60_000;

const CONCURRENCY = 5;

/** Bounded so one run stays well inside its lease, same reasoning as the
 *  sweep's own batch limit. A backlog drains over consecutive runs. */
const BATCH_LIMIT = 100;

export interface ReconcileResult {
  checked: number;
  credited: number;
  recovered: number;
  failed: number;
  mismatched: number;
  /** References the gateway confirmed but that we could not safely credit. */
  needsAttention: string[];
}

export async function reconcileDeposits(): Promise<ReconcileResult> {
  const now = Date.now();
  const rows = await db.transaction.findMany({
    where: {
      type: "DEPOSIT",
      // FAILED included on purpose — recovering wrongly-closed deposits is
      // half the point of this pass.
      status: { in: ["PENDING", "FAILED"] },
      // Only gateway deposits. Manual superadmin credits carry other prefixes
      // and never had a gateway charge to reconcile against.
      reference: { startsWith: "dep_" },
      createdAt: {
        lt: new Date(now - MIN_AGE_MS),
        gt: new Date(now - LOOKBACK_MS),
      },
    },
    // See sweep.ts — the gateway coordinates travel with the row.
    select: { reference: true, amountMinor: true, status: true, gatewayTransactionId: true, gatewayRaw: true },
    orderBy: { createdAt: "desc" },
    take: BATCH_LIMIT,
  });

  const result: ReconcileResult = {
    checked: rows.length,
    credited: 0,
    recovered: 0,
    failed: 0,
    mismatched: 0,
    needsAttention: [],
  };

  if (rows.length === 0) return result;

  async function checkOne(row: (typeof rows)[number]): Promise<void> {
    try {
      const status = await checkPaymentStatus(row.reference, row.amountMinor, gatewayRefFrom(row));

      if (isMismatch(status.status)) {
        // Money moved but something did not line up. Never close this row —
        // surface it instead.
        result.mismatched += 1;
        result.needsAttention.push(row.reference);
        console.error(
          `[reconcile] MISMATCH on ${row.reference}: the gateway confirms payment but the ` +
            `details do not match our record. Left open for manual review.`
        );
        return;
      }

      const mapped = toTransactionStatus(status.status);

      if (mapped === "SUCCESS") {
        await creditSuccessfulDeposit(row.reference, status.raw);
        if (row.status === "FAILED") result.recovered += 1;
        else result.credited += 1;

        if (status.transactionId) {
          await db.transaction.updateMany({
            where: { reference: row.reference, gatewayTransactionId: null },
            data: { gatewayTransactionId: String(status.transactionId) },
          });
        }
        return;
      }

      // Only close rows that were still open. A row already FAILED stays
      // FAILED without a pointless write.
      if (mapped === "FAILED" && row.status === "PENDING") {
        await markFailedDeposit(row.reference, status.raw);
        result.failed += 1;
      }
    } catch (err) {
      // A misconfiguration will fail identically for every row, so re-throw and
      // let the caller stop. Grinding through the whole batch would bury one
      // real problem under a hundred identical stack traces.
      if (err instanceof PaymentsServiceConfigError) throw err;

      // Permanent for this row but harmless to the batch: the gateway it was
      // taken on is no longer registered, so retrying can never resolve it.
      // One line rather than a stack trace on every pass.
      if (isRetiredProviderError(err)) {
        console.warn(`[reconcile] ${row.reference} was taken on a retired gateway — needs a manual decision.`);
        return;
      }

      // A transient gateway hiccup, on the other hand, must never close a
      // deposit — leave it and retry on the next run.
      console.error(`[reconcile] status check failed for ${row.reference}:`, err);
    }
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(checkOne));
  }

  if (result.credited || result.recovered || result.mismatched) {
    console.info(
      `[reconcile] checked=${result.checked} credited=${result.credited} ` +
        `recovered=${result.recovered} failed=${result.failed} mismatched=${result.mismatched}`
    );
  }

  return result;
}
