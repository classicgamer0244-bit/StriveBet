/**
 * Restores a mongoexport-style NDJSON dump (one JSON document per line,
 * MongoDB extended JSON) from prisma/dump/<Collection>.json into the
 * matching collection, preserving every original _id and cross-collection
 * reference exactly as exported.
 *
 * Deliberately bypasses PrismaClient and writes straight through the
 * MongoDB driver: prisma/seed.ts's upsert-by-unique-field calls would mint
 * brand-new ObjectIds for anything not already present, silently breaking
 * every id-shaped reference in the dump (User.referredById, Bet.accountId,
 * Transaction.referringAdminId, ...). Idempotent — safe to re-run — because
 * every write is a replaceOne(..., { upsert: true }) keyed on the dump's own
 * _id, never an insert.
 *
 * Run `prisma db push` BEFORE this, so the target collections/indexes exist
 * first (Mongo has no shadow-db migrations for this connector).
 *
 * Usage: npx tsx prisma/import-dump.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, type Document } from "mongodb";
import { EJSON, Long } from "bson";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = path.join(__dirname, "dump");
const BATCH_SIZE = 1000;

// Load .env manually — this is a standalone tsx script, not the Prisma CLI,
// so nothing auto-loads it for us.
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  let text: string;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
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

// Fields the Prisma schema declares as BigInt — these must land as BSON
// Int64 (Long), never Double, or Prisma's Mongo connector fails to hydrate
// them. mongoexport's default "relaxed" extended JSON drops small Int64
// values down to plain JSON numbers, which the Node driver would otherwise
// insert as Double.
const BIGINT_FIELDS: Record<string, string[]> = {
  Bet: ["stakeMinor", "potentialPayoutMinor", "payoutMinor"],
  AdminFixture: ["simKickoffTs", "secondHalfKickoffTs"],
};

// Internal cache/lock/quota collections: nothing in the schema points a
// foreign key at their _id (unlike User/AdminAccount/Bet/.../BookingSlip,
// which MUST keep the dump's exact _id or every cross-collection reference
// breaks). A live app instance can have already bootstrapped its own copy
// of one of these under a different _id than the dump's — so for these we
// match on their real unique business key instead and let Mongo keep
// whichever _id the live document already has (or mint a fresh one if it
// doesn't exist yet).
const NATURAL_KEY_FIELDS: Record<string, string> = {
  SyncLock: "key",
  ApiFootballQuota: "key",
  IlotbetSyncState: "key",
  ApiFixtureCache: "apiFixtureId",
  IlotbetFixtureCache: "matchId",
  FixtureSettlementState: "fixtureId",
};

// True singleton, no natural key at all — match whatever single document
// already exists (if any), same reasoning as NATURAL_KEY_FIELDS above.
const SINGLETON_COLLECTIONS = new Set(["PlatformSettings"]);

function toLong(value: unknown): Long | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Long) return value;
  if (typeof value === "number") return Long.fromNumber(value);
  if (typeof value === "string") return Long.fromString(value);
  // Already-canonical EJSON {$numberLong: "..."} that EJSON.parse turned
  // into a Long-like object, or something unexpected — try its string form.
  return Long.fromString(String(value));
}

function fixBigIntFields(collectionName: string, doc: Document): Document {
  const fields = BIGINT_FIELDS[collectionName];
  if (!fields) return doc;
  for (const field of fields) {
    if (field in doc) {
      const converted = toLong(doc[field]);
      if (converted !== null) doc[field] = converted;
    }
  }
  return doc;
}

async function importFile(client: MongoClient, dbName: string, filePath: string) {
  const collectionName = path.basename(filePath, ".json");
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    console.log(`  ${collectionName}: empty file, skipped`);
    return;
  }

  const collection = client.db(dbName).collection(collectionName);

  let upserted = 0;
  let modified = 0;
  let matched = 0;

  const naturalKey = NATURAL_KEY_FIELDS[collectionName];
  const isSingleton = SINGLETON_COLLECTIONS.has(collectionName);

  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    const ops = batch.map((line) => {
      const doc = fixBigIntFields(collectionName, EJSON.parse(line) as Document);
      const { _id, ...rest } = doc;
      if (isSingleton) {
        // Match whatever single document already exists, if any — never
        // try to force the dump's _id onto it.
        return { replaceOne: { filter: {}, replacement: rest, upsert: true } };
      }
      if (naturalKey) {
        // Match by business key, not _id — leaves a pre-existing live
        // document's own _id untouched instead of colliding with it.
        return {
          replaceOne: {
            filter: { [naturalKey]: doc[naturalKey] },
            replacement: rest,
            upsert: true,
          },
        };
      }
      return {
        replaceOne: {
          filter: { _id },
          replacement: { _id, ...rest },
          upsert: true,
        },
      };
    });
    const result = await collection.bulkWrite(ops, { ordered: false });
    upserted += result.upsertedCount;
    modified += result.modifiedCount;
    matched += result.matchedCount;
  }

  console.log(
    `  ${collectionName}: ${lines.length} docs — ${upserted} inserted, ${modified} updated, ${
      matched - modified
    } unchanged`,
  );
}

async function main() {
  loadEnv();
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not set (checked process.env and .env)");

  const dbNameMatch = uri.match(/\.net\/([^/?]+)/) ?? uri.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbNameMatch?.[1];
  if (!dbName) throw new Error(`Could not determine database name from DATABASE_URL`);

  const files = readdirSync(DUMP_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) throw new Error(`No .json files found in ${DUMP_DIR}`);

  console.log(`Target database: ${dbName}`);
  console.log(`Importing ${files.length} collections from ${DUMP_DIR}\n`);

  const client = new MongoClient(uri);
  await client.connect();
  const failures: string[] = [];
  try {
    for (const file of files) {
      try {
        await importFile(client, dbName, path.join(DUMP_DIR, file));
      } catch (err) {
        failures.push(file);
        console.error(`  ${file}: FAILED — ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    await client.close();
  }

  if (failures.length > 0) {
    console.log(`\nImport finished with ${failures.length} failed file(s): ${failures.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("\nImport complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
