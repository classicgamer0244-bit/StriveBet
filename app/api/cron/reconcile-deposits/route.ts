import { NextResponse } from "next/server";
import { runIfDue } from "@/lib/sync/lock";
import { DEPOSIT_RECONCILE_JOB } from "@/lib/deposits/reconcile-job";
import { reconcileDeposits } from "@/lib/deposits/reconcile";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Deep reconciliation against the gateway.
 *
 * Distinct from /api/cron/sweep-pending-deposits, which is the fast two-minute
 * backstop for deposits still in flight. This one is the slow safety net for
 * the cases that backstop cannot reach: rows older than its 24-hour cutoff, and
 * rows wrongly closed as FAILED. See lib/deposits/reconcile.ts.
 *
 * runIfDue's lock makes a cron-triggered run and a superadmin-triggered one
 * indistinguishable, so this is safe to hit at any cadence.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runIfDue(DEPOSIT_RECONCILE_JOB, async () => void (await reconcileDeposits()));
  return NextResponse.json({ outcome: result });
}
