import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signSession, verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";
import type { AdminAccount, AdminRole, User } from "@prisma/client";

const COOKIE_NAME = "maxbet_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type CurrentSession = { kind: "user"; user: User } | { kind: "admin"; admin: AdminAccount };

/** Authoritative per-request identity check — always re-reads the account
 * from the database (not just the JWT) so a suspension/approval/role change
 * takes effect immediately instead of waiting for the token to expire. */
export async function getSession(): Promise<CurrentSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  if (payload.kind === "user") {
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    return user ? { kind: "user", user } : null;
  }

  const admin = await db.adminAccount.findUnique({ where: { id: payload.sub } });
  return admin ? { kind: "admin", admin } : null;
}

export async function requireUser(): Promise<User | null> {
  const session = await getSession();
  return session?.kind === "user" ? session.user : null;
}

/** Optionally restrict to a specific admin role (ADMIN vs SUPERADMIN). Does
 * NOT check status (pending/suspended) — callers that need a hard gate on
 * status should check `admin.status` themselves; some read-only endpoints
 * intentionally allow pending/suspended admins through. */
export async function requireAdmin(role?: AdminRole): Promise<AdminAccount | null> {
  const session = await getSession();
  if (session?.kind !== "admin") return null;
  if (role && session.admin.role !== role) return null;
  return session.admin;
}

/**
 * Normalizes "whoever is signed in" into one shape for the money/betting
 * code paths — players and staff share the same login path and can both
 * bet/deposit/withdraw, but live in separate collections. `referrerAdminId`
 * carries whichever field plays that role for the account (User.referredById
 * or AdminAccount.createdByAdminId) so deposit commission logic doesn't need
 * to know which kind it's looking at.
 */
export interface PlayerAccount {
  kind: "user" | "admin";
  id: string;
  firstName: string;
  lastName: string;
  balanceMinor: number;
  currency: string;
  phone: string;
  email: string | null;
  referrerAdminId: string | null;
  /** Withdrawal-eligibility tracking — see prisma/schema.prisma's field
   * comments on User/AdminAccount for the full rules. */
  depositsSinceReset: number;
  penaltyDepositRequired: boolean;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
}

export async function requirePlayerAccount(): Promise<PlayerAccount | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.kind === "user") {
    const { user } = session;
    return {
      kind: "user",
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      balanceMinor: user.balanceMinor,
      currency: user.currency,
      phone: user.phone,
      email: user.email,
      referrerAdminId: user.referredById,
      depositsSinceReset: user.depositsSinceReset ?? 0,
      penaltyDepositRequired: user.penaltyDepositRequired ?? false,
      status: user.status,
    };
  }

  const { admin } = session;
  return {
    kind: "admin",
    id: admin.id,
    firstName: admin.displayName,
    lastName: "",
    balanceMinor: admin.balanceMinor,
    currency: admin.currency,
    phone: admin.phone,
    email: admin.email,
    referrerAdminId: admin.createdByAdminId,
    depositsSinceReset: admin.depositsSinceReset ?? 0,
    penaltyDepositRequired: admin.penaltyDepositRequired ?? false,
    status: admin.status,
  };
}
