import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
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

const passwordHash = await bcrypt.hash("Max0244", 10);
const result = await db
  .collection("AdminAccount")
  .updateOne({ email: "hq@maxbet.example" }, { $set: { passwordHash } });

console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);
await client.close();
