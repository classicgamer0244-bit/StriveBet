import { readFileSync } from "node:fs";
import path from "node:path";

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

const res = await fetch("https://sms.txtaro.com/api/v1/sms/history", {
  headers: { Authorization: `Bearer ${process.env.TXTARO_API_KEY}` },
});

console.log("HTTP status:", res.status);
console.log("Response:", await res.text());
