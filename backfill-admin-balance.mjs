import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const result = await db.$runCommandRaw({
  update: "AdminAccount",
  updates: [
    { q: { balanceMinor: null }, u: { $set: { balanceMinor: 0 } }, multi: true },
    { q: { balanceMinor: { $exists: false } }, u: { $set: { balanceMinor: 0 } }, multi: true },
    { q: { currency: { $exists: false } }, u: { $set: { currency: "GHS" } }, multi: true },
  ],
});
console.log("Backfill result:", JSON.stringify(result));

const check = await db.adminAccount.findMany({ select: { displayName: true, balanceMinor: true, currency: true } });
console.log("After backfill:", JSON.stringify(check, null, 2));

await db.$disconnect();
