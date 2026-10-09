import { NextResponse } from "next/server";
import { pumpSettlementJobs } from "@/lib/settlement/scheduler";
import { sweepOrphanedOpenBets } from "@/lib/settlement/settle-bets-for-fixtures";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { nowMs } from "@/lib/id";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Budget for the whole request, comfortably inside maxDuration.
 *
 * This is the fix for a real production failure: "Vercel Runtime Timeout Error:
 * Task timed out after 60 seconds". Each step below is individually bounded,
 * but they run in SEQUENCE, so their budgets add up — the resolver's 20s plus
 * settlement's 30s already exceeds the ceiling before the tick or the overdue
 * sweep have run at all. Individually-bounded work in a sequence is unbounded
 * work. One shared deadline governs the request instead, and every step stops
 * cleanly against it.
 *
 * The 12s of headroom absorbs a step that overshoots its own check (an
 * in-flight DB round trip can't be interrupted) plus response serialization.
 * Being killed here is not merely untidy: the platform kills the function
 * mid-flight, so anything past its last completed transaction is simply lost
 * work that has to be redone next cycle.
 */
const REQUEST_BUDGET_MS = 48_000;

/**
 * The settlement heartbeat, for an external scheduler.
 *
 * Everything here also runs off organic traffic via the my-bets SSE loop, and
 * every job is lock-guarded, so this route adds no duplicated work — it exists
 * purely to cover the window where organic traffic is zero. That window is not
 * hypothetical: with no scheduler at all, an admin fixture kicking off late
 * evening did not even advance to FINISHED until some unrelated user next
 * opened the app, which is exactly why late-night games were reported as never
 * settling.
 *
 * Order matters: advance admin fixtures, then resolve any real fixture whose
 * result we still don't know, then settle whatever became ready as a result.
 * Nothing here is lost if the budget runs out mid-way — settlement is
 * per-bet atomic and every job is resumable, so the next run continues.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadlineMs = startedAt + REQUEST_BUDGET_MS;

  let failures = 0;
  const step = async <T>(name: string, run: () => Promise<T>): Promise<T | null> => {
    if (Date.now() >= deadlineMs) {
      console.warn(`settle-sweep: skipping ${name} — request budget exhausted`);
      return null;
    }
    try {
      return await run();
    } catch (err) {
      failures += 1;
      console.error(`settle-sweep: ${name} failed:`, err);
      return null;
    }
  };

  await step("tick-admin-fixtures", () => tickAdminFixturesIfDue(nowMs(), { deadlineMs }));
  await step("settlement-jobs", () => pumpSettlementJobs({ deadlineMs }));
  const sweep = await step("orphan-sweep", () => sweepOrphanedOpenBets({ deadlineMs }));

  const durationMs = Date.now() - startedAt;
  if (durationMs >= REQUEST_BUDGET_MS) {
    console.warn(`settle-sweep: used its full ${REQUEST_BUDGET_MS}ms budget — work continues next run`);
  }

  return NextResponse.json({ ok: failures === 0, durationMs, sweep });
}
