import { NextResponse } from "next/server";
import { pumpApiFootballSyncs } from "@/lib/api-football/sync/scheduler";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Optional, settlement-tail only now — api-football is no longer the
 * listings/odds source (see lib/ilotbet/, and
 * app/api/cron/sync-ilotbet/route.ts for its equivalent). Every read path
 * that still needs the legacy tail already calls
 * ensureApiFootballFresh()/pumpApiFootballSyncs() itself, so this route
 * exists only so a real external scheduler CAN be pointed at it — not
 * because one is required for correctness. Safe to delete once
 * app/api/superadmin/api-football/status's `legacyOpenBets` reads 0.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await pumpApiFootballSyncs();
  return NextResponse.json({ ok: true });
}
