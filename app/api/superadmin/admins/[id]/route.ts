import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeAdmin } from "@/lib/auth/serialize";
import { fromMinor } from "@/lib/money";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const merchant = await db.adminAccount.findUnique({ where: { id } });
  if (!merchant) return NextResponse.json({ error: "Merchant not found." }, { status: 404 });
  if (merchant.role === "SUPERADMIN") return NextResponse.json({ error: "Cannot delete a superadmin." }, { status: 400 });

  // Detach users so future deposits go fully to superadmin (no admin cut)
  await db.user.updateMany({ where: { referredById: id }, data: { referredById: null } });
  // Clear referringAdminId on any pending transactions so no commission is credited
  await db.transaction.updateMany({ where: { referringAdminId: id, status: "PENDING" }, data: { referringAdminId: null } });
  await db.adminAccount.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const merchant = await db.adminAccount.findUnique({ where: { id } });
  if (!merchant) return NextResponse.json({ error: "Merchant not found." }, { status: 404 });

  const [referredUsersCount, grossDeposits] = await Promise.all([
    db.user.count({ where: { referredById: id } }),
    db.transaction.findMany({ where: { type: "DEPOSIT", referringAdminId: id } }),
  ]);
  const grossReceived = fromMinor(grossDeposits.reduce((s, t) => s + t.amountMinor, 0));

  return NextResponse.json({ admin: serializeAdmin(merchant), referredUsersCount, grossReceived });
}
