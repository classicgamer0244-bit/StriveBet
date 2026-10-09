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
const HT_HOME = 1;
const HT_AWAY = 1; // recorded halftime score, unaffected by the minute-90 correction

type Grade = "won" | "lost" | "void" | "unknown";

function gradeLeg(marketName: string, selectionLabel: string, home: number, away: number): Grade {
  const total = home + away;
  const home2h = home - HT_HOME;
  const away2h = away - HT_AWAY;

  switch (marketName) {
    case "1X2":
      if (selectionLabel === "Home") return home > away ? "won" : "lost";
      if (selectionLabel === "Draw") return home === away ? "won" : "lost";
      if (selectionLabel === "Away") return away > home ? "won" : "lost";
      break;
    case "Double Chance":
      if (selectionLabel === "Home or Draw") return home >= away ? "won" : "lost";
      if (selectionLabel === "Home or Away") return home !== away ? "won" : "lost";
      if (selectionLabel === "Draw or Away") return home <= away ? "won" : "lost";
      break;
    case "Both Teams To Score":
      if (selectionLabel === "Yes") return home > 0 && away > 0 ? "won" : "lost";
      if (selectionLabel === "No") return !(home > 0 && away > 0) ? "won" : "lost";
      break;
    case "Draw No Bet":
      if (home === away) return "void";
      if (selectionLabel === "Home") return home > away ? "won" : "lost";
      if (selectionLabel === "Away") return away > home ? "won" : "lost";
      break;
    case "Total 0.5":
    case "Total 1.5":
    case "Total 2.5":
    case "Total 3.5":
    case "Total 4.5": {
      const threshold = parseFloat(marketName.replace("Total ", ""));
      if (selectionLabel.startsWith("Over")) return total > threshold ? "won" : "lost";
      if (selectionLabel.startsWith("Under")) return total < threshold ? "won" : "lost";
      break;
    }
    case "Odd/even":
    case "Total Goals Odd/Even":
      if (selectionLabel === "Odd") return total % 2 === 1 ? "won" : "lost";
      if (selectionLabel === "Even") return total % 2 === 0 ? "won" : "lost";
      break;
    case "Home Team Total Goals Over/Under 1.5":
      if (selectionLabel.startsWith("Over")) return home > 1.5 ? "won" : "lost";
      if (selectionLabel.startsWith("Under")) return home < 1.5 ? "won" : "lost";
      break;
    case "Away Team Total Goals Over/Under 1.5":
      if (selectionLabel.startsWith("Over")) return away > 1.5 ? "won" : "lost";
      if (selectionLabel.startsWith("Under")) return away < 1.5 ? "won" : "lost";
      break;
    case "1st Half Result":
      if (selectionLabel === "Home") return HT_HOME > HT_AWAY ? "won" : "lost";
      if (selectionLabel === "Draw") return HT_HOME === HT_AWAY ? "won" : "lost";
      if (selectionLabel === "Away") return HT_AWAY > HT_HOME ? "won" : "lost";
      break;
    case "2nd Half Result":
      if (selectionLabel === "Home") return home2h > away2h ? "won" : "lost";
      if (selectionLabel === "Draw") return home2h === away2h ? "won" : "lost";
      if (selectionLabel === "Away") return away2h > home2h ? "won" : "lost";
      break;
    case "Half With Most Goals": {
      const first = HT_HOME + HT_AWAY;
      const second = home2h + away2h;
      if (selectionLabel === "1st Half") return first > second ? "won" : "lost";
      if (selectionLabel === "2nd Half") return second > first ? "won" : "lost";
      if (selectionLabel === "Equal") return first === second ? "won" : "lost";
      break;
    }
    case "Correct Score": {
      const known = ["0:0","0:1","0:2","0:3","0:4","1:0","1:1","1:2","1:3","1:4","2:0","2:1","2:2","2:3","2:4","3:0","3:1","3:2","3:3","3:4","4:0","4:1","4:2","4:3","4:4"];
      const actual = `${home}:${away}`;
      if (selectionLabel === "Other") return !known.includes(actual) ? "won" : "lost";
      return selectionLabel === actual ? "won" : "lost";
    }
    case "HT/FT": {
      const code = (h: number, a: number) => (h > a ? "1" : h === a ? "X" : "2");
      const actual = `${code(HT_HOME, HT_AWAY)}/${code(home, away)}`;
      return selectionLabel === actual ? "won" : "lost";
    }
    case "Winning Margin": {
      const margin = home - away;
      if (selectionLabel === "Home by 1") return margin === 1 ? "won" : "lost";
      if (selectionLabel === "Home by 2+") return margin >= 2 ? "won" : "lost";
      if (selectionLabel === "Draw") return margin === 0 ? "won" : "lost";
      if (selectionLabel === "Away by 1") return margin === -1 ? "won" : "lost";
      if (selectionLabel === "Away by 2+") return margin <= -2 ? "won" : "lost";
      break;
    }
  }
  return "unknown";
}

const bets = await db.collection("Bet").find({ "legs.fixtureId": fixtureId }).toArray();

let flipsToWon = 0;
let flipsToLost = 0;
let unknownMarkets = 0;
let payoutNewlyOwedMinor = 0;
let payoutToClawBackMinor = 0;
const detail: string[] = [];

for (const b of bets) {
  const leg = b.legs.find((l: any) => l.fixtureId === fixtureId);
  const recorded = gradeLeg(leg.marketName, leg.selectionLabel, 2, 1);
  const corrected = gradeLeg(leg.marketName, leg.selectionLabel, 2, 2);

  if (corrected === "unknown" || recorded === "unknown") {
    unknownMarkets++;
    detail.push(`UNKNOWN market grading: bet=${b._id} market="${leg.marketName}" selection="${leg.selectionLabel}" (needs manual check)`);
    continue;
  }

  if (recorded !== corrected) {
    const otherLegs = b.legs.filter((l: any) => l.fixtureId !== fixtureId);
    const otherLegsAllWon = otherLegs.every((l: any) => l.result === "won" || l.result === "void" || l.result === "push");

    if (recorded === "lost" && corrected === "won" && b.status === "LOST" && otherLegsAllWon) {
      flipsToWon++;
      payoutNewlyOwedMinor += b.potentialPayoutMinor ?? 0;
      detail.push(
        `FLIP TO WON: bet=${b._id} accountKind=${b.accountKind} mode=${b.mode} market="${leg.marketName}" sel="${leg.selectionLabel}" stakeGHS=${(b.stakeMinor/100).toFixed(2)} newPayoutGHS=${((b.potentialPayoutMinor ?? 0)/100).toFixed(2)}`
      );
    } else if (recorded === "won" && corrected === "lost" && b.status === "WON") {
      flipsToLost++;
      payoutToClawBackMinor += b.payoutMinor ?? 0;
      detail.push(
        `FLIP TO LOST (clawback risk): bet=${b._id} accountKind=${b.accountKind} mode=${b.mode} market="${leg.marketName}" sel="${leg.selectionLabel}" alreadyPaidGHS=${((b.payoutMinor ?? 0)/100).toFixed(2)} settledAt=${b.settledAt}`
      );
    } else {
      detail.push(
        `Leg result changes (${recorded}->${corrected}) but doesn't change overall slip status: bet=${b._id} status=${b.status} market="${leg.marketName}" sel="${leg.selectionLabel}"`
      );
    }
  }
}

console.log(detail.join("\n"));
console.log("\n=== SUMMARY ===");
console.log(`Total bets referencing this fixture: ${bets.length}`);
console.log(`Markets we couldn't confidently grade (handicaps etc): ${unknownMarkets}`);
console.log(`Slips that would flip LOST -> WON (new payout owed): ${flipsToWon}, totaling GHS ${(payoutNewlyOwedMinor/100).toFixed(2)}`);
console.log(`Slips that would flip WON -> LOST (already paid out, clawback): ${flipsToLost}, totaling GHS ${(payoutToClawBackMinor/100).toFixed(2)}`);

await client.close();
