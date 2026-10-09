import { readFileSync } from "node:fs";
import path from "node:path";

const DUMP = path.join("prisma", "dump");

function loadLines(file: string) {
  return readFileSync(path.join(DUMP, file), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
}

const admins = new Set(loadLines("AdminAccount.json").map((d) => d._id.$oid));
const users = new Set(loadLines("User.json").map((d) => d._id.$oid));

const MISSING_ADMIN_IDS = new Set([
  "6a6e1ff37a0c1cfc91cd26d5",
  "6a6df050af98a147c7e387c2",
  "6a99fa1173c3c24ad0d8bccb",
  "6a99dc4550659f4249126747",
]);
const MISSING_USER_IDS = new Set(["6a6ddca7f59e64eded52d2f7", "6a708bf9ff94db6dead03815"]);

const bets = loadLines("Bet.json");
let openCount = 0;
let openStake = 0;
let wonUnpaidCount = 0;
const statusCounts: Record<string, number> = {};

for (const b of bets) {
  const id = b.accountId?.$oid;
  if (!MISSING_ADMIN_IDS.has(id) && !MISSING_USER_IDS.has(id)) continue;
  statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
  if (b.status === "OPEN") {
    openCount++;
    openStake += Number(b.stakeMinor);
  }
}

console.log("Bets belonging to missing accounts, by status:", statusCounts);
console.log(`OPEN bets still to settle: ${openCount}, total stake at risk: ${openStake / 100} GHS`);

const txs = loadLines("Transaction.json");
let txTotal = 0;
let txCount = 0;
for (const t of txs) {
  const id = t.accountId?.$oid;
  if (!MISSING_ADMIN_IDS.has(id) && !MISSING_USER_IDS.has(id)) continue;
  txCount++;
  txTotal += Number(t.amountMinor);
}
console.log(`Transactions tied to missing accounts: ${txCount}, net amount: ${txTotal / 100} GHS`);
