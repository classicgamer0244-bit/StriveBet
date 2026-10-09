import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { serializeAdmin, serializeUser } from "@/lib/auth/serialize";
import { phoneVariants } from "@/lib/auth/phone";

const bodySchema = z.object({
  phone: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Single login path for everyone — players, admins, and superadmins all sign
 * in with phone + password here. Phone numbers are unique across both the
 * User and AdminAccount collections (enforced at account-creation time), so
 * at most one of the two lookups below can match; whichever does determines
 * the session kind. Staff land on the normal site after signing in and reach
 * their dashboard via the role-aware brand-name link, not a redirect here.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your phone number and password." }, { status: 400 });
  }

  const variants = phoneVariants(parsed.data.phone);
  const [user, admin] = await Promise.all([
    db.user.findFirst({ where: { phone: { in: variants } } }),
    db.adminAccount.findFirst({ where: { phone: { in: variants } } }),
  ]);

  if (user && (await verifyPassword(parsed.data.password, user.passwordHash))) {
    await setSessionCookie({ sub: user.id, kind: "user" });
    return NextResponse.json({ kind: "user", account: serializeUser(user) });
  }

  if (admin && (await verifyPassword(parsed.data.password, admin.passwordHash))) {
    await setSessionCookie({ sub: admin.id, kind: "admin" });
    return NextResponse.json({ kind: "admin", account: serializeAdmin(admin) });
  }

  return NextResponse.json({ error: "Invalid phone number or password." }, { status: 401 });
}
