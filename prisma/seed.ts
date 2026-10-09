import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/** Every seeded demo account (superadmin/admins/users) shares this password,
 * purely for local testing — never used for anything real. */
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD ?? "Demo1234!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const superadmin = await db.adminAccount.upsert({
    where: { email: "hq@maxbet.example" },
    update: {},
    create: {
      displayName: "MaxBet HQ",
      email: "hq@maxbet.example",
      phone: "0200000000",
      passwordHash,
      referralCode: "H9K2QP",
      role: "SUPERADMIN",
      status: "ACTIVE",
    },
  });

  const admin1 = await db.adminAccount.upsert({
    where: { email: "kojo@agency.example" },
    update: {},
    create: {
      displayName: "Kojo Agency",
      email: "kojo@agency.example",
      phone: "0244000001",
      passwordHash,
      referralCode: "7XR4M2",
      role: "ADMIN",
      status: "ACTIVE",
      createdByAdminId: superadmin.id,
    },
  });

  await db.adminAccount.upsert({
    where: { email: "ama@bets.example" },
    update: {},
    create: {
      displayName: "Ama Bets",
      email: "ama@bets.example",
      phone: "0244000002",
      passwordHash,
      referralCode: "B3WQ8T",
      role: "ADMIN",
      status: "PENDING",
      createdByAdminId: superadmin.id,
    },
  });

  await db.user.upsert({
    where: { phone: "0545143000" },
    update: {},
    create: {
      firstName: "Kwame",
      lastName: "Mensah",
      phone: "0545143000",
      countryCode: "+233",
      countryFlag: "GH",
      email: "kwame.mensah@example.com",
      passwordHash,
      gender: "MALE",
      status: "ACTIVE",
      referredById: admin1.id,
    },
  });

  await db.user.upsert({
    where: { phone: "0501112222" },
    update: {},
    create: {
      firstName: "Yaw",
      lastName: "Owusu",
      phone: "0501112222",
      countryCode: "+233",
      countryFlag: "GH",
      passwordHash,
      status: "SUSPENDED",
      referredById: admin1.id,
    },
  });

  const existingSettings = await db.platformSettings.findFirst();
  if (!existingSettings) {
    await db.platformSettings.create({ data: { minDepositAmountMinor: 30400 } });
  }

  console.log(`Seed complete. Every account's password is: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
