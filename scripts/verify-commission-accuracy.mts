import { readFileSync } from "node:fs";
import path from "node:path";
import { MongoClient, ObjectId } from "mongodb";

function loadEnv() {
  const text = readFileSync(path.join(".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();
const client = new MongoClient(process.env.DATABASE_URL!);
await client.connect();
const db = client.db("maxbet");

const superadmin = await db.collection("AdminAccount").findOne({ role: "SUPERADMIN" });
console.log(`Superadmin: ${superadmin?.displayName} (${superadmin?._id}), earningsMinor=${superadmin?.earningsMinor}`);

// Every DEPOSIT that ever recorded a commission split
const allCommissioned = await db
  .collection("Transaction")
  .find({ type: "DEPOSIT", adminCommissionMinor: { $ne: null } })
  .project({ referringAdminId: 1, accountId: 1, amountMinor: 1, adminCommissionMinor: 1, superadminCommissionMinor: 1, status: 1, createdAt: 1 })
  .toArray();

console.log(`\nAll DEPOSIT transactions with a commission split recorded: ${allCommissioned.length}`);
for (const t of allCommissioned) console.log(JSON.stringify(t));

// Sum what SHOULD be in each referring admin's earnings from commission alone
const expectedByAdmin: Record<string, number> = {};
for (const t of allCommissioned) {
  if (t.status !== "SUCCESS") continue;
  if (t.referringAdminId && t.adminCommissionMinor) {
    expectedByAdmin[t.referringAdminId] = (expectedByAdmin[t.referringAdminId] ?? 0) + t.adminCommissionMinor;
  }
  if (t.superadminCommissionMinor && superadmin) {
    expectedByAdmin[String(superadmin._id)] = (expectedByAdmin[String(superadmin._id)] ?? 0) + t.superadminCommissionMinor;
  }
}

console.log("\n=== Expected commission-only totals per admin (from SUCCESS deposits) ===");
for (const [adminId, expected] of Object.entries(expectedByAdmin)) {
  const acc = await db.collection("AdminAccount").findOne({ _id: new ObjectId(adminId) });
  console.log(
    `${acc?.displayName ?? adminId}: expected-from-commission=${expected}, actual earningsMinor=${acc?.earningsMinor}`
  );
}

await client.close();
