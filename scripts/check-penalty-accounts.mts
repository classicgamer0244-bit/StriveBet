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
const m = process.env.DATABASE_URL!.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
if (!m) throw new Error("Could not parse DATABASE_URL");
const [, user, pass, , dbName] = m;
const shardHosts = [
  "ac-pj5gv8d-shard-00-00.3pv3dcw.mongodb.net:27017",
  "ac-pj5gv8d-shard-00-01.3pv3dcw.mongodb.net:27017",
  "ac-pj5gv8d-shard-00-02.3pv3dcw.mongodb.net:27017",
].join(",");
const directUri = `mongodb://${user}:${pass}@${shardHosts}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;

const client = new MongoClient(directUri);
await client.connect();
const db = client.db(dbName);

const flagged = await db
  .collection("User")
  .find({ $or: [{ penaltyDepositRequired: true }, { refundsSincePenalty: { $gt: 0 } }] })
  .project({ phone: 1, depositsSinceReset: 1, refundsSincePenalty: 1, penaltyDepositRequired: 1, updatedAt: 1 })
  .toArray();

console.log(`Users with penalty flag or nonzero refund counter: ${flagged.length}\n`);
for (const u of flagged) {
  console.log(JSON.stringify(u));
  const refunds = await db
    .collection("Transaction")
    .find({ accountId: u._id, type: "REFUND" })
    .project({ amountMinor: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`  ${refunds.length} REFUND transaction(s):`, refunds.map((r) => r.createdAt).join(", "));
}

await client.close();
