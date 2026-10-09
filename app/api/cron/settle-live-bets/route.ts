import { NextResponse } from "next/server";
import { settleLiveBets } from "@/lib/settlement/settle-live-bets";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/** For an external scheduler. Real fixtures aren't persisted/watched, so
 * nothing else triggers settlement for bets on them — this route is the only
 * path that closes that loop today. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await settleLiveBets();
  return NextResponse.json(result);
}
