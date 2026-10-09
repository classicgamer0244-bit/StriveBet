/**
 * One-off fix for a data gap in the friend's dump: 4 AdminAccount ids and 2
 * User ids are referenced by real Bet/Transaction/AdminFixture rows but were
 * never included in AdminAccount.json / User.json. Left alone, any bet still
 * OPEN against one of them makes settlement's creditBalanceChecked() abort
 * forever (by design — it refuses to credit money into a nonexistent
 * account rather than silently losing or fabricating it).
 *
 * This creates clearly-marked placeholder accounts under the EXACT missing
 * _id values so references resolve and settlement can proceed. Deliberately
 * does NOT attempt to reconstruct a historical balance from the accounts'
 * past Transaction rows — the type/sign semantics needed to replay a ledger
 * correctly are easy to get wrong, and a wrong guess on a real-money
 * platform is worse than starting at 0 with an honest flag. Every created
 * account starts at balanceMinor 0, SUSPENDED (blocked from placing new
 * bets — see app/api/bets/route.ts's status check), with an unguessable
 * random password so nobody can log into it, and a displayName that says
 * outright it needs manual review.
 *
 * Usage: npx tsx scripts/restore-missing-accounts.mts
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
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

const MISSING_ADMIN_IDS = [
  "6a6e1ff37a0c1cfc91cd26d5",
  "6a6df050af98a147c7e387c2",
  "6a99fa1173c3c24ad0d8bccb",
  "6a99dc4550659f4249126747",
];
const MISSING_USER_IDS = ["6a6ddca7f59e64eded52d2f7", "6a708bf9ff94db6dead03815"];

async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("hex"), 10);
}

async function main() {
  loadEnv();
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not set");
  const dbNameMatch = uri.match(/\.net\/([^/?]+)/) ?? uri.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbNameMatch?.[1];
  if (!dbName) throw new Error("Could not determine database name from DATABASE_URL");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const adminColl = db.collection("AdminAccount");
    for (const [i, id] of MISSING_ADMIN_IDS.entries()) {
      const oid = new ObjectId(id);
      const existing = await adminColl.findOne({ _id: oid });
      if (existing) {
        console.log(`AdminAccount ${id}: already exists, skipped`);
        continue;
      }
      const passwordHash = await unusablePasswordHash();
      const now = new Date();
      await adminColl.insertOne({
        _id: oid,
        displayName: `[NEEDS REVIEW — restored placeholder, original account missing from dump]`,
        email: `restored-admin-${id}@needs-review.invalid`,
        phone: `0000${String(i).padStart(6, "0")}`,
        passwordHash,
        referralCode: `RVW${i}${id.slice(-3).toUpperCase()}`,
        role: "ADMIN",
        status: "SUSPENDED",
        earningsMinor: 0,
        balanceMinor: 0,
        currency: "GHS",
        createdAt: now,
        updatedAt: now,
      });
      console.log(`AdminAccount ${id}: created placeholder`);
    }

    const userColl = db.collection("User");
    for (const [i, id] of MISSING_USER_IDS.entries()) {
      const oid = new ObjectId(id);
      const existing = await userColl.findOne({ _id: oid });
      if (existing) {
        console.log(`User ${id}: already exists, skipped`);
        continue;
      }
      const passwordHash = await unusablePasswordHash();
      const now = new Date();
      await userColl.insertOne({
        _id: oid,
        firstName: "[NEEDS REVIEW]",
        lastName: "restored placeholder",
        phone: `0001${String(i).padStart(6, "0")}`,
        countryCode: "+233",
        countryFlag: "GH",
        passwordHash,
        balanceMinor: 0,
        currency: "GHS",
        status: "SUSPENDED",
        hasWonBet: false,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`User ${id}: created placeholder`);
    }
  } finally {
    await client.close();
  }

  console.log("\nDone. These accounts are SUSPENDED with unguessable passwords — nobody can log into");
  console.log("them, and app/api/bets/route.ts blocks new bets on a non-ACTIVE account. Balances");
  console.log("start at 0 (their real prior Transaction history was NOT replayed in — verify manually).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
