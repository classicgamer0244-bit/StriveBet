import { readFileSync } from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { MongoClient } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

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

// SRV/TXT DNS lookups are timing out on this network right now; build a
// direct (non-SRV) connection string from the known shard hosts so we don't
// depend on those record types resolving.
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
const db = client.db("maxbet");

const fixtures = await db
  .collection("AdminFixture")
  .find({
    $or: [
      { homeTeamName: /manukau/i, awayTeamName: /melville/i },
      { homeTeamName: /melville/i, awayTeamName: /manukau/i },
    ],
  })
  .sort({ createdAt: -1 })
  .toArray();

console.log(`Found ${fixtures.length} matching fixture(s)\n`);
for (const f of fixtures) {
  console.log(JSON.stringify(f, null, 2));
  console.log("---");

  const bets = await db.collection("Bet").find({ fixtureId: f._id.toString() }).toArray();
  console.log(`  ${bets.length} bet(s) on this fixture:`);
  for (const b of bets) {
    console.log(
      `    bet ${b._id} userId=${b.userId} status=${b.status} pick=${JSON.stringify(b.selection ?? b.pick ?? {})} stakeMinor=${b.stakeMinor} payoutMinor=${b.payoutMinor}`
    );
  }
  console.log("===");
}

await client.close();
