import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import type { AdminAccount, AdminFixture } from "@prisma/client";

export type FixtureControllerResult =
  | { ok: true; admin: AdminAccount; fixture: AdminFixture }
  | { ok: false; status: number; error: string };

/** Admins can only control matches they created; superadmins can control any. */
export async function requireFixtureController(fixtureId: string): Promise<FixtureControllerResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, status: 401, error: "Unauthorized" };

  const fixture = await db.adminFixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { ok: false, status: 404, error: "Match not found." };

  if (admin.role === "ADMIN" && fixture.ownerAdminId !== admin.id) {
    return { ok: false, status: 403, error: "You don't own this match." };
  }

  return { ok: true, admin, fixture };
}
