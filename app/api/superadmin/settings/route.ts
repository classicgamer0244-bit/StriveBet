import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/settings";
import { toMinor, fromMinor } from "@/lib/money";

const bodySchema = z.object({
  minDepositAmount: z.number().positive().optional(),
  depositsEnabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const settings = await getPlatformSettings();
  const updated = await db.platformSettings.update({
    where: { id: settings.id },
    data: {
      ...(parsed.data.minDepositAmount !== undefined
        ? { minDepositAmountMinor: toMinor(parsed.data.minDepositAmount) }
        : {}),
      ...(parsed.data.depositsEnabled !== undefined
        ? { depositsEnabled: parsed.data.depositsEnabled }
        : {}),
    },
  });

  return NextResponse.json({
    minDepositAmount: fromMinor(updated.minDepositAmountMinor),
    depositsEnabled: updated.depositsEnabled,
  });
}
