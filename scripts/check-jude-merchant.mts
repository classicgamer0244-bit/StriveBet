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

console.log("=== Merchant 'Jude' AdminAccount ===");
const jude = await db.collection("AdminAccount").findOne({ displayName: "Jude" });
console.log(JSON.stringify(jude, null, 2));

console.log("\n=== Who is 6a6b753f119e4b1645b658d0 (the GHS1 test's referringAdminId)? ===");
const referrer = await db.collection("AdminAccount").findOne({ _id: "6a6b753f119e4b1645b658d0" });
console.log(JSON.stringify(referrer, null, 2));

console.log("\n=== Account 6a9951f1d9d611d87fdcf960 (who made the GHS1 deposit)? ===");
const depositor = await db.collection("User").findOne({ _id: "6a9951f1d9d611d87fdcf960" });
console.log(JSON.stringify(depositor, null, 2));

if (jude) {
  console.log("\n=== Users referred by Jude ===");
  const referred = await db.collection("User").find({ referredById: jude._id }).toArray();
  console.log(`Count: ${referred.length}`);
  for (const u of referred) console.log(JSON.stringify(u));

  console.log("\n=== Deposits referred by Jude ===");
  const deposits = await db.collection("Transaction").find({ referringAdminId: jude._id }).toArray();
  console.log(`Count: ${deposits.length}`);
  for (const d of deposits) console.log(JSON.stringify(d));
}

await client.close();
