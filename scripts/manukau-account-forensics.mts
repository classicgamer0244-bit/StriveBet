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

const fixture = await db.collection("AdminFixture").findOne({ _id: new ObjectId(fixtureId) });
console.log(`Fixture owner (creating admin): ${fixture?.ownerAdminId}, createdAt=${fixture?.createdAt}\n`);

for (const b of bets) {
  const leg = b.legs.find((l: any) => l.fixtureId === fixtureId);
  if (leg.marketName !== "Correct Score" || leg.selectionLabel !== "2:2") continue;

  const account =
    b.accountKind === "USER"
      ? await db.collection("User").findOne({ _id: new ObjectId(b.accountId) })
      : await db.collection("AdminAccount").findOne({ _id: new ObjectId(b.accountId) });

  const priorBetsCount = await db.collection("Bet").countDocuments({
    accountId: b.accountId,
    placedAt: { $lt: b.placedAt },
  });

  const deposits = await db
    .collection("Transaction")
    .find({ accountId: b.accountId, type: "DEPOSIT", status: "SUCCESS" })
    .sort({ createdAt: 1 })
    .toArray();

  const acctCreatedAt = account?.createdAt;
  const ageAtBetMs = acctCreatedAt ? new Date(b.placedAt).getTime() - new Date(acctCreatedAt).getTime() : null;
  const ageAtBetHours = ageAtBetMs !== null ? (ageAtBetMs / 3_600_000).toFixed(1) : "unknown";

  console.log(
    [
      `bet=${b._id}`,
      `accountKind=${b.accountKind}`,
      `accountId=${b.accountId}`,
      `phone=${account?.phone ?? "?"}`,
      `acctCreatedAt=${acctCreatedAt}`,
      `ageAtBetHours=${ageAtBetHours}`,
      `referredById/referringAdminId=${account?.referredById ?? account?.createdByAdminId ?? "-"}`,
      `betsBeforeThis=${priorBetsCount}`,
      `depositsCount=${deposits.length}`,
      `firstDepositAt=${deposits[0]?.createdAt ?? "-"}`,
      `totalDepositedGHS=${(deposits.reduce((s, d) => s + (d.amountMinor ?? 0), 0) / 100).toFixed(2)}`,
      `stakeGHS=${(b.stakeMinor / 100).toFixed(2)}`,
      `newPayoutGHS≈${((b.potentialPayoutMinor ?? 0) / 100).toFixed(2)}`,
    ].join(" | ")
  );
}

await client.close();
