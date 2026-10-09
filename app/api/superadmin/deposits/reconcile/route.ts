import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { reconcileDeposits } from "@/lib/deposits/reconcile";
import { PaymentsServiceConfigError } from "@/lib/payments-service";

/**
 * Runs the deep gateway reconciliation on demand, for when an admin reports
 * "this customer paid but nothing showed up" and nobody wants to wait for the
 * ten-minute cron.
 *
 * Deliberately NOT wrapped in runIfDue: the scheduled run is rate-limited so it
 * does not hammer the gateway, but a superadmin pressing the button means "check
 * now", and a lock-guarded no-op would look like the button was broken.
 * reconcileDeposits() is safe to run concurrently — crediting goes through
 * creditSuccessfulDeposit()'s atomic guard.
 */
export async function POST() {
  const superadmin = await requireAdmin("SUPERADMIN");
  if (!superadmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await reconcileDeposits();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Manual deposit reconciliation failed:", err);

    // A misconfiguration is actionable, and only a superadmin sees this — so
    // show the real reason rather than a generic "try again" they cannot act on.
    if (err instanceof PaymentsServiceConfigError) {
      return NextResponse.json({ error: err.message, configuration: true }, { status: 503 });
    }

    return NextResponse.json(
      { error: "Couldn't reach the payment service. Please try again." },
      { status: 502 }
    );
  }
}
