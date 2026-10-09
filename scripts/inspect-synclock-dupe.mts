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
const coll = client.db("maxbet").collection("SyncLock");

const totalDocs = await coll.countDocuments();
const grouped = await coll
  .aggregate([{ $group: { _id: "$key", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
  .toArray();

console.log(`Total SyncLock documents: ${totalDocs}`);
console.log(`Distinct keys: ${grouped.length}`);
console.log("Per-key counts:");
for (const g of grouped) console.log(`  ${g._id}: ${g.count}`);

await client.close();
