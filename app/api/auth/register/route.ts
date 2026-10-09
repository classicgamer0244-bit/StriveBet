import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";
import { DEFAULT_COUNTRY_CODE, DEFAULT_COUNTRY_FLAG } from "@/lib/constants";
import { normalizePhone, phoneVariants } from "@/lib/auth/phone";

const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(6).max(64),
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
});

/** No OTP step — a single call creates the account and signs the user in
 * immediately, per the confirmed decision to drop signup verification entirely. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    console.error("[register] validation failed:", JSON.stringify(errors));
    const first = Object.values(errors).flat()[0];
    return NextResponse.json({ error: first ?? "Please check the details you entered." }, { status: 400 });
  }

  const { firstName, lastName, password } = parsed.data;
  // Store the canonical (no leading 0) form so both variants always resolve
  // to the same row regardless of how the user types it at login.
  const phone = normalizePhone(parsed.data.phone);
  const email = parsed.data.email ? parsed.data.email.toLowerCase() : undefined;
  const referralCode = parsed.data.referralCode || undefined;

  const variants = phoneVariants(parsed.data.phone);
  const [userByPhone, adminByPhone] = await Promise.all([
    db.user.findFirst({ where: { phone: { in: variants } } }),
    db.adminAccount.findFirst({ where: { phone: { in: variants } } }),
  ]);
  if (userByPhone || adminByPhone) {
    return NextResponse.json({ error: "That phone number is already registered." }, { status: 409 });
  }

  if (email) {
    const [userByEmail, adminByEmail] = await Promise.all([
      db.user.findFirst({ where: { email } }),
      db.adminAccount.findUnique({ where: { email } }),
    ]);
    if (userByEmail || adminByEmail) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
  }

  let referredById: string | undefined;
  if (referralCode) {
    const admin = await db.adminAccount.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
    if (admin) referredById = admin.id;
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await db.user.create({
      data: {
        firstName,
        lastName,
        phone,
        email,
        passwordHash,
        countryCode: DEFAULT_COUNTRY_CODE,
        countryFlag: DEFAULT_COUNTRY_FLAG,
        referredById,
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      const target = (err as { meta?: { target?: string | string[] } }).meta?.target;
      const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "");
      const message = targetStr.includes("email")
        ? "That email is already registered."
        : "That phone number is already registered.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }

  await setSessionCookie({ sub: user.id, kind: "user" });
  return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
}
