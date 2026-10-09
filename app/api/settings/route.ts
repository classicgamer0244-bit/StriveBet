import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/settings";
import { fromMinor } from "@/lib/money";

/** No role required — the deposit form needs this pre-login-adjacent info too. */
export async function GET() {
  const settings = await getPlatformSettings();
  return NextResponse.json({
    minDepositAmount: fromMinor(settings.minDepositAmountMinor),
    depositsEnabled: settings.depositsEnabled,
  });
}
