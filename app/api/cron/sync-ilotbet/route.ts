import { NextResponse } from "next/server";
import { pumpIlotbetSyncs } from "@/lib/ilotbet/sync/scheduler";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Optional. The whole point of the lock-guarded sync design
 * (lib/ilotbet/sync/) is that it needs no external scheduler at all — every
 * read path (Route Handlers, Server Components, the my-bets SSE loop)
 * already calls ensureIlotbetFresh()/pumpIlotbetSyncs() itself, so the cache
 * stays warm purely from organic traffic. This route exists so a real
 * scheduler CAN be pointed at it later with zero code change — the locks
 * make a cron-triggered run and an organic one indistinguishable — not
 * because one is required for correctness.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await pumpIlotbetSyncs();
  return NextResponse.json({ ok: true });
}
