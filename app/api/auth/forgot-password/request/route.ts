import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendSms, toArkeselNumber } from "@/lib/arkesel";
import { phoneVariants } from "@/lib/auth/phone";

const bodySchema = z.object({ phone: z.string().trim().min(6).max(20) });

const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Always returns the same generic response whether or not the phone is
 * registered, to avoid leaking which numbers have accounts. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const variants = phoneVariants(parsed.data.phone);
  const user = await db.user.findFirst({ where: { phone: { in: variants } } });

  if (!user) {
    return NextResponse.json({ error: "No account found with that phone number." }, { status: 404 });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await db.passwordResetOtp.upsert({
    where: { phone: user.phone },
    create: { phone: user.phone, code, expiresAt },
    update: { code, expiresAt },
  });

  try {
    const intlPhone = toArkeselNumber(user.phone, user.countryCode);
    await sendSms(intlPhone, `Your StriveBet password reset code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`);
  } catch (err) {
    console.error("Failed to send password-reset SMS:", err);
  }

  return NextResponse.json({ message: "A verification code has been sent to your number." });
}
