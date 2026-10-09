import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";

const PREFIX = "MX";
// No ambiguous chars (no I/O/0/1).
const generateSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export async function generateUniqueBookingCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${PREFIX}${generateSuffix()}`;
    const existing = await db.bookingSlip.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique booking code.");
}
