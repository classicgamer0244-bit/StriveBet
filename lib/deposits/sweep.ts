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

/** How long a PENDING deposit sits untouched before this sweep starts
 * checking it — mirrors app/api/deposits/status/route.ts's own
 * SELF_HEAL_AFTER_MS grace period, for the same reason: the first several
 * seconds after initiation are normal (the customer hasn't even seen the
 * MoMo approval prompt yet), so checking immediately would just waste a
 * call against the payments service. */
const CHECK_AFTER_MS = 15_000;

/** A real MoMo approval prompt resolves (or the platform's own USSD session
 * times out) within minutes, not days — a deposit still PENDING after this
 * long is effectively abandoned. Excluded from the query rather than
 * force-marked FAILED: Flutterwave could in principle still resolve it, and
 * guessing FAILED on a deposit that later turns out to have actually
 * completed would strand a real payment with nothing left to notice the
 * mismatch. Left PENDING indefinitely for manual investigation instead. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SWEEP_CONCURRENCY = 5;

/** Caps how many rows one invocation checks. PENDING_DEPOSIT_SWEEP_JOB's
 * leaseMs (lib/deposits/sweep-job.ts) assumes a run finishes in well under
 * 60s; an unbounded backlog (confirmed once in production: 768 rows took
 * ~380s to fully drain) would blow well past that, risking a second
 * instance treating the lease as expired and starting a fully overlapping
 * run. A larger backlog just drains gradually over several ttlMs-spaced
 * cycles instead of all at once — this is a backstop, not expected to be
 * instant. */
const SWEEP_BATCH_LIMIT = 40;

/**
 * Backstop for the exact failure mode reported: a customer's charge actually
 * completes (Flutterwave debits them) but our own PENDING row never
 * transitions. The callback now crosses an app boundary — Flutterwave notifies
 * the payments service, which forwards to app/api/webhooks/payments — so there
 * are two hops that can drop it rather than one, and the deposit form's own
 * client-side poll
 * (components/account/deposit-form.tsx) gives up after 2 minutes — so a
 * customer who closes the app or navigates away before then leaves nothing
 * left polling the gateway on their behalf, and the deposit sits PENDING
 * forever with no automatic retry.
 *
 * Hooked into the my-bets SSE loop (app/api/realtime/my-bets/route.ts) via
 * runIfDue, so this keeps running in the background for as long as the
 * customer has any tab open with an active session — unlike the deposit
 * form's own poll, it isn't tied to that form still being mounted.
 *
 * Reuses creditSuccessfulDeposit/markFailedDeposit's own atomic
 * PENDING-guarded update, so this can never double-credit a deposit the
 * webhook or the status route's self-heal already resolved a moment
 * earlier — same "whichever lands first wins" race already relied on
 * everywhere else in the deposit flow.
 */
export async function sweepPendingDeposits(): Promise<{ checked: number; credited: number; failed: number }> {
  const cutoff = new Date(Date.now() - CHECK_AFTER_MS);
  const oldestAllowed = new Date(Date.now() - MAX_AGE_MS);
  const pending = await db.transaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "PENDING",
      // Was `gatewayTransactionId: { isSet: true }` under BulkClix, which minted
      // its gateway id up front. Flutterwave doesn't: the numeric transaction id
      // only exists once a charge completes, so that filter would now exclude
      // every single sweepable deposit — the exact rows this backstop is for.
      //
      // The `dep_` prefix is the right test instead. It is already the marker
      // for a genuine gateway deposit (manual credits and non-gateway rows
      // carry other prefixes), and under Flutterwave the reference IS the
      // gateway reference, so it is all a status check needs.
      reference: { startsWith: "dep_" },
      createdAt: { lt: cutoff, gt: oldestAllowed },
    },
    // gatewayTransactionId + gatewayRaw are needed to ask the RIGHT gateway,
    // and to ask a gateway that can only be queried by its own id.
    select: { reference: true, amountMinor: true, gatewayTransactionId: true, gatewayRaw: true },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH_LIMIT,
  });
  if (pending.length === 0) return { checked: 0, credited: 0, failed: 0 };

  let credited = 0;
  let failed = 0;

  async function checkOne(txn: {
    reference: string;
    amountMinor: number;
    gatewayTransactionId: string | null;
    gatewayRaw: unknown;
  }): Promise<void> {
    try {
      // Legacy BulkClix-era rows are swept harmlessly: Flutterwave has no
      // record of their references, which reads as PENDING and leaves them
      // untouched for manual investigation, exactly as before.
      const result = await checkPaymentStatus(txn.reference, txn.amountMinor, gatewayRefFrom(txn));

      if (isMismatch(result.status)) {
        // The gateway confirms money moved but the details disagree. Left
        // PENDING deliberately — see lib/deposits/reconcile.ts, which reports
        // these for manual review. Closing it here would lose a real payment.
        console.error(
          `[sweep] MISMATCH on ${txn.reference}: gateway confirms payment, details do not match.`
        );
        return;
      }

      const mapped = toTransactionStatus(result.status);
      if (mapped === "SUCCESS") {
        await creditSuccessfulDeposit(txn.reference, result.raw);
        credited += 1;
      } else if (mapped === "FAILED") {
        await markFailedDeposit(txn.reference, result.raw);
        failed += 1;
      }
    } catch (err) {
      // A misconfiguration fails identically for every row, so abort the whole
      // batch instead of logging the same stack trace forty times a cycle.
      // Thrown out of the sweep so runIfDue records it once and applies the
      // job's error backoff, rather than hot-looping against a dead endpoint.
      if (err instanceof PaymentsServiceConfigError) throw err;

      // Permanent for this row but harmless to the batch — the gateway it was
      // taken on no longer exists in the registry, so no amount of retrying
      // resolves it. One line, not a stack trace every cycle.
      if (isRetiredProviderError(err)) {
        console.warn(
          `[sweep] ${txn.reference} was taken on a retired gateway — cannot resolve automatically, needs a manual decision.`
        );
        return;
      }

      console.error(`pending deposit sweep: status check failed for ${txn.reference}:`, err);
    }
  }

  for (let i = 0; i < pending.length; i += SWEEP_CONCURRENCY) {
    await Promise.all(pending.slice(i, i + SWEEP_CONCURRENCY).map(checkOne));
  }

  return { checked: pending.length, credited, failed };
}
