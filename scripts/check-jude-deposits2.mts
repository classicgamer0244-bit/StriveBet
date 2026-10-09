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

const judeId = "6a9951f1d9d611d87fdcf960";

const deposits = await db
  .collection("Transaction")
  .find({ referringAdminId: judeId, type: "DEPOSIT" })
  .project({ status: 1, amountMinor: 1, adminCommissionMinor: 1, superadminCommissionMinor: 1, performedByAdminId: 1, createdAt: 1 })
  .toArray();

console.log(`Total DEPOSIT-type transactions referred by Jude: ${deposits.length}`);
const byStatus: Record<string, number> = {};
for (const d of deposits) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
console.log("By status:", byStatus);

const successNoCommission = deposits.filter(
  (d) => d.status === "SUCCESS" && (d.adminCommissionMinor === undefined || d.adminCommissionMinor === null)
);
console.log(`\nSUCCESS deposits with NO commission recorded: ${successNoCommission.length}`);
for (const d of successNoCommission.slice(0, 10)) console.log(JSON.stringify(d));

const successWithCommission = deposits.filter((d) => d.status === "SUCCESS" && d.adminCommissionMinor != null);
console.log(`\nSUCCESS deposits WITH commission recorded: ${successWithCommission.length}`);
for (const d of successWithCommission.slice(0, 10)) console.log(JSON.stringify(d));

await client.close();
