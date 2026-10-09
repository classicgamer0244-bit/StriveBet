import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveSelections } from "@/lib/bets/resolve-selections";
import { generateUniqueBookingCode } from "@/lib/booking/code";
import { nowMs } from "@/lib/id";

const bodySchema = z.object({
  selections: z
    .array(z.object({ fixtureId: z.string(), marketId: z.string(), selectionId: z.string() }))
    .min(1)
    .max(20),
});

const EXPIRY_MS = 72 * 60 * 60 * 1000;

/** Identity of a booking slip is its set of picks, not the odds they were
 * saved at (odds are re-resolved fresh on load either way) — order-
 * independent so the same picks added in a different order still match. */
function computeSelectionsHash(selections: { fixtureId: string; marketId: string; selectionId: string }[]): string {
  const key = selections
    .map((s) => `${s.fixtureId}:${s.marketId}:${s.selectionId}`)
    .sort()
    .join("|");
  return createHash("sha1").update(key).digest("hex");
}

/** No login required to save a slip — matches real sportsbooks, where
 * booking codes are freely shareable and only staking them requires an account. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid selections." }, { status: 400 });

  const result = await resolveSelections(parsed.data.selections);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const selectionsHash = computeSelectionsHash(result.resolved);
  const now = nowMs();
  const expiresAt = new Date(now + EXPIRY_MS);

  // Same exact picks already booked and still valid — reuse that code
  // instead of minting a new one, so the code only ever changes when the
  // admin/user actually adds, edits, or removes a selection. Bump its
  // expiry too, since re-booking is the user actively re-confirming it.
  const existing = await db.bookingSlip.findFirst({ where: { selectionsHash, expiresAt: { gt: new Date(now) } } });
  if (existing) {
    const updated = await db.bookingSlip.update({ where: { id: existing.id }, data: { expiresAt } });
    return NextResponse.json({ code: updated.code, expiresAt: updated.expiresAt.toISOString() });
  }

  const code = await generateUniqueBookingCode();

  await db.bookingSlip.create({
    data: {
      code,
      expiresAt,
      selectionsHash,
      selections: result.resolved.map((r) => ({
        fixtureId: r.fixtureId,
        fixtureLabel: r.fixtureLabel,
        marketId: r.marketId,
        marketName: r.marketName,
        selectionId: r.selectionId,
        selectionLabel: r.selectionLabel,
        oddsAtBooking: r.odds,
      })),
    },
  });

  return NextResponse.json({ code, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
