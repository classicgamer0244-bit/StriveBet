import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/settings";
import { fromMinor } from "@/lib/money";

/**
 * Superadmin housekeeping for the overview dashboard.
 *
 * Both actions clear a *display* figure that has built up over months or years.
 * Neither destroys anything:
 *
 *   - `deposits` sets a cutoff instant. The deposit-volume figures then only
 *     count transactions after it. Every transaction row survives, individual
 *     account histories and balances are untouched, and the clear is undone by
 *     setting `restore: true`.
 *   - `earnings` zeroes the superadmin's own commission ledger. Unlike settling
 *     an ADMIN's earnings (.../admins/[id]/reset-earnings), this deliberately
 *     writes NO transaction row: nobody was paid, the counter was just reset.
 *     A DEPOSIT row here would inflate the very deposit total being tidied up.
 */

const bodySchema = z.object({
  target: z.enum(["deposits", "earnings"]),
  /** Only meaningful for `deposits` — lifts the cutoff and shows all history again. */
  restore: z.boolean().optional(),
});

export async function POST(request: Request) {
  const superadmin = await requireAdmin("SUPERADMIN");
  if (!superadmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const settings = await getPlatformSettings();
  const now = new Date();

  if (parsed.data.target === "deposits") {
    const restore = parsed.data.restore === true;
    const updated = await db.platformSettings.update({
      where: { id: settings.id },
      data: { depositsResetAt: restore ? null : now },
    });
    return NextResponse.json({
      target: "deposits",
      depositsResetAt: updated.depositsResetAt?.toISOString() ?? null,
      message: restore
        ? "Deposit totals now show all history again."
        : "Deposit totals cleared. Past transactions are still recorded.",
    });
  }

  const clearedMinor = superadmin.earningsMinor;
  if (clearedMinor === 0) {
    return NextResponse.json({ error: "Your earnings are already at zero." }, { status: 400 });
  }

  await db.adminAccount.update({
    where: { id: superadmin.id },
    data: { earningsMinor: 0 },
  });
  await db.platformSettings.update({
    where: { id: settings.id },
    data: { earningsResetAt: now },
  });

  return NextResponse.json({
    target: "earnings",
    clearedAmount: fromMinor(clearedMinor),
    earningsResetAt: now.toISOString(),
    message: "Your earnings ledger has been cleared.",
  });
}
