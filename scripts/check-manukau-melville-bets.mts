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

const fixtureId = "6aa98f0d1cb0946e2b6a2b86";

const bets = await db.collection("Bet").find({ "legs.fixtureId": fixtureId }).toArray();
console.log(`Bets with a leg on this fixture: ${bets.length}`);

for (const b of bets) {
  console.log(JSON.stringify(b, null, 2));
}

await client.close();
