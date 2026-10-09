import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";

const GENDER_TO_PRISMA = {
  male: "MALE",
  female: "FEMALE",
  other: "OTHER",
  "prefer-not-to-say": "PREFER_NOT_TO_SAY",
} as const;

const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().email().optional(),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
});

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { gender, ...rest } = parsed.data;
  const updated = await db.user.update({
    where: { id: user.id },
    data: { ...rest, ...(gender ? { gender: GENDER_TO_PRISMA[gender] } : {}) },
  });
  return NextResponse.json({ user: serializeUser(updated) });
}
