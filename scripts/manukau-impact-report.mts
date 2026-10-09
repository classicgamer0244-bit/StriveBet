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

const fixtureId = "6aa98f0d1cb0946e2b6a2b86";
const bets = await db.collection("Bet").find({ "legs.fixtureId": fixtureId }).toArray();

let wouldFlipCount = 0;
let wouldFlipPayoutMinor = 0;
const rows: string[] = [];

for (const b of bets) {
  const leg = b.legs.find((l: any) => l.fixtureId === fixtureId);
  const otherLegs = b.legs.filter((l: any) => l.fixtureId !== fixtureId);
  const allOthersWon = otherLegs.every((l: any) => l.result === "won" || l.result === "void" || l.result === "push");
  // This leg is currently "lost" only because of the missing goal (score 2:1 vs scripted 2:2).
  // It would flip to won ONLY for selections that are literally about this exact leg's market.
  const isThisLegAffected = leg.result === "lost";
  const wouldSlipFlip = b.status === "LOST" && isThisLegAffected && allOthersWon;

  if (wouldSlipFlip) {
    wouldFlipCount++;
    wouldFlipPayoutMinor += b.potentialPayoutMinor ?? 0;
  }

  rows.push(
    `bet=${b._id} accountKind=${b.accountKind} mode=${b.mode} status=${b.status} stakeGHS=${(b.stakeMinor / 100).toFixed(2)} potentialPayoutGHS=${((b.potentialPayoutMinor ?? 0) / 100).toFixed(2)} thisLegMarket="${leg.marketName}" thisLegSelection="${leg.selectionLabel}" thisLegResult=${leg.result} otherLegsAllWon=${allOthersWon} wouldFlipToWon=${wouldSlipFlip}`
  );
}

console.log(rows.join("\n"));
console.log("\n=== SUMMARY ===");
console.log(`Total bets referencing this fixture: ${bets.length}`);
console.log(`Bets that would flip from LOST to WON if we correct the score to 2:2: ${wouldFlipCount}`);
console.log(`Total new payout that would become owed: GHS ${(wouldFlipPayoutMinor / 100).toFixed(2)}`);

const realFlips = bets.filter((b) => {
  const leg = b.legs.find((l: any) => l.fixtureId === fixtureId);
  const otherLegs = b.legs.filter((l: any) => l.fixtureId !== fixtureId);
  const allOthersWon = otherLegs.every((l: any) => l.result === "won" || l.result === "void" || l.result === "push");
  return b.status === "LOST" && leg.result === "lost" && allOthersWon && b.mode === "REAL";
});
console.log(`Of those, REAL-money bets: ${realFlips.length}`);
console.log(`  by accountKind: ADMIN=${realFlips.filter((b) => b.accountKind === "ADMIN").length}, USER=${realFlips.filter((b) => b.accountKind === "USER").length}`);

await client.close();
