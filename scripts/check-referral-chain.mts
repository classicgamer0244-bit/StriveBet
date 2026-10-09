import { readFileSync } from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

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

console.log("=== Most recently created Users ===");
const users = await db
  .collection("User")
  .find({}, { projection: { firstName: 1, lastName: 1, phone: 1, referredById: 1, createdAt: 1 } })
  .sort({ createdAt: -1 })
  .limit(5)
  .toArray();
for (const u of users) console.log(JSON.stringify(u));

console.log("\n=== Most recent SUCCESS deposits ===");
const txns = await db
  .collection("Transaction")
  .find({ type: "DEPOSIT", status: "SUCCESS" }, { projection: { accountId: 1, amountMinor: 1, referringAdminId: 1, adminCommissionMinor: 1, superadminCommissionMinor: 1, createdAt: 1 } })
  .sort({ createdAt: -1 })
  .limit(5)
  .toArray();
for (const t of txns) console.log(JSON.stringify(t));

console.log("\n=== AdminAccounts with earningsMinor > 0 ===");
const admins = await db
  .collection("AdminAccount")
  .find({ earningsMinor: { $gt: 0 } }, { projection: { displayName: 1, referralCode: 1, earningsMinor: 1 } })
  .toArray();
for (const a of admins) console.log(JSON.stringify(a));

await client.close();
