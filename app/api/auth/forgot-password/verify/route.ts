import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";
import { phoneVariants } from "@/lib/auth/phone";

const bodySchema = z.object({
  phone: z.string().trim().min(6).max(20),
  code: z.string().trim().min(4).max(8),
  newPassword: z.string().min(6).max(64),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the details you entered." }, { status: 400 });
  }

  const variants = phoneVariants(parsed.data.phone);
  const user = await db.user.findFirst({ where: { phone: { in: variants } } });
  if (!user) return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });

  const otp = await db.passwordResetOtp.findUnique({ where: { phone: user.phone } });
  if (!otp || otp.code !== parsed.data.code || otp.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  // Consume the OTP so it can't be reused.
  await db.passwordResetOtp.delete({ where: { phone: user.phone } });

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const updated = await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  await setSessionCookie({ sub: updated.id, kind: "user" });
  return NextResponse.json({ user: serializeUser(updated) });
}
