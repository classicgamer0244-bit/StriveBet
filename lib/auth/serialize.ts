import type { AdminAccount, User } from "@prisma/client";
import { fromMinor } from "@/lib/money";

/**
 * Maps Prisma's UPPERCASE enum values back onto the lowercase string
 * literals the existing frontend types (types/user.ts, types/admin.ts) and
 * every admin/superadmin component already expect — so swapping the data
 * source from the old localStorage store to these API responses requires no
 * changes to display/conditional logic across the app.
 */

const USER_STATUS = { ACTIVE: "active", SUSPENDED: "suspended" } as const;
const GENDER = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
  PREFER_NOT_TO_SAY: "prefer-not-to-say",
} as const;
const ADMIN_ROLE = { ADMIN: "admin", SUPERADMIN: "superadmin" } as const;
const ADMIN_STATUS = { PENDING: "pending", ACTIVE: "active", SUSPENDED: "suspended" } as const;

export function serializeUser(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    countryCode: user.countryCode,
    countryFlag: user.countryFlag,
    balance: fromMinor(user.balanceMinor),
    currency: user.currency,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email ?? undefined,
    gender: user.gender ? GENDER[user.gender] : undefined,
    role: "user" as const,
    status: USER_STATUS[user.status],
    referredBy: user.referredById ?? undefined,
    depositsSinceReset: user.depositsSinceReset ?? 0,
    penaltyDepositRequired: user.penaltyDepositRequired ?? false,
    hasWonBet: user.hasWonBet ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeAdmin(admin: AdminAccount) {
  return {
    id: admin.id,
    displayName: admin.displayName,
    email: admin.email,
    phone: admin.phone,
    referralCode: admin.referralCode,
    role: ADMIN_ROLE[admin.role],
    status: ADMIN_STATUS[admin.status],
    createdByAdminId: admin.createdByAdminId ?? undefined,
    earnings: fromMinor(admin.earningsMinor),
    balance: fromMinor(admin.balanceMinor),
    currency: admin.currency,
    depositsSinceReset: admin.depositsSinceReset ?? 0,
    penaltyDepositRequired: admin.penaltyDepositRequired ?? false,
    createdAt: admin.createdAt.toISOString(),
  };
}
