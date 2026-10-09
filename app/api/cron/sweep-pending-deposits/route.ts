import { NextResponse } from "next/server";
import { runIfDue } from "@/lib/sync/lock";
import { PENDING_DEPOSIT_SWEEP_JOB } from "@/lib/deposits/sweep-job";
import { sweepPendingDeposits } from "@/lib/deposits/sweep";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * The sweep also runs as a side effect of the my-bets SSE loop (any
 * logged-in user, any page — see app/api/realtime/my-bets/route.ts), which
 * covers almost all real traffic. This route exists for the gap that leaves:
 * a quiet window with zero active sessions platform-wide would otherwise
 * mean a stuck deposit waits for the next unrelated user to open the app,
 * same as .../cron/sync-ilotbet's reasoning for existing. runIfDue's lock
 * makes a cron-triggered run and an SSE-triggered one indistinguishable, so
 * pointing a real scheduler at this is safe to do at any cadence.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runIfDue(PENDING_DEPOSIT_SWEEP_JOB, async () => void (await sweepPendingDeposits()));
  return NextResponse.json({ outcome: result });
}
