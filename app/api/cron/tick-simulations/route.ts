import { NextResponse } from "next/server";
import { tickAdminFixtures } from "@/lib/simulation/tick";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { nowMs } from "@/lib/id";

/** For an external scheduler (e.g. every 15-30s). The same advancement also
 * runs lazily/throttled on every /api/fixtures read (lib/fixtures.ts), so
 * this route is a belt-and-suspenders addition, not a hard dependency. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // `changed` carries raw Prisma rows (BigInt fields) — not JSON-serializable
  // directly, and this route only needs to report counts, not the fixtures.
  const { finishedIds, changed } = await tickAdminFixtures(nowMs());
  return NextResponse.json({ finishedIds, changedCount: changed.length });
}
