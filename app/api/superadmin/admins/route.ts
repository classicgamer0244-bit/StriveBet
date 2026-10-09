import { NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { serializeAdmin } from "@/lib/auth/serialize";
import { parsePageParams, paginate } from "@/lib/pagination";

const generateReferralCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const bodySchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(20),
  password: z.string().min(8).max(64),
});

export async function GET(request: Request) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, status } = parsePageParams(searchParams);

  const where: Prisma.AdminAccountWhereInput = { role: "ADMIN" };
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status === "pending" || status === "active" || status === "suspended") {
    where.status = status.toUpperCase() as "PENDING" | "ACTIVE" | "SUSPENDED";
  }

  const result = await paginate({
    page,
    pageSize,
    count: () => db.adminAccount.count({ where }),
    findMany: (args) => db.adminAccount.findMany({ where, orderBy: { createdAt: "desc" }, ...args }),
  });

  return NextResponse.json({ items: result.items.map(serializeAdmin), total: result.total });
}

export async function POST(request: Request) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Please check the merchant details." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const [byEmail, adminByPhone, userByPhone] = await Promise.all([
    db.adminAccount.findUnique({ where: { email } }),
    db.adminAccount.findUnique({ where: { phone: parsed.data.phone } }),
    db.user.findUnique({ where: { phone: parsed.data.phone } }),
  ]);
  if (byEmail || adminByPhone || userByPhone) {
    return NextResponse.json({ error: "That email or phone is already in use." }, { status: 409 });
  }

  let referralCode = generateReferralCode();
  for (let i = 0; i < 5 && (await db.adminAccount.findUnique({ where: { referralCode } })); i++) {
    referralCode = generateReferralCode();
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const merchant = await db.adminAccount.create({
    data: {
      displayName: parsed.data.displayName,
      email,
      phone: parsed.data.phone,
      passwordHash,
      referralCode,
      role: "ADMIN",
      status: "PENDING",
      createdByAdminId: admin.id,
    },
  });

  return NextResponse.json({ admin: serializeAdmin(merchant) }, { status: 201 });
}
