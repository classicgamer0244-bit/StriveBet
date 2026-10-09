import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";

// "GH" (Ghana) + "MX" (MaxBet) + 12 alphanumeric chars, e.g. "GHMXAB12CD34EF56".
const PREFIX = "GHMX";
// No ambiguous chars (no I/O/0/1) — same alphabet as lib/booking/code.ts.
const generateSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);

/** Generated only when a bet settles WON — shown in the win celebration
 * modal and the ticket page, lets support staff verify a payout claim. */
export async function generateUniqueVerificationCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${PREFIX}${generateSuffix()}`;
    const existing = await db.bet.findFirst({ where: { verificationCode: code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique verification code.");
}
