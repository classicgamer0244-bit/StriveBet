import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
const apiKey = process.env.CLOUDINARY_API_KEY!;
const apiSecret = process.env.CLOUDINARY_API_SECRET!;

const timestamp = Math.floor(Date.now() / 1000);
const folder = "strivebet/team-logos";
const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
const signature = crypto.createHash("sha1").update(`${paramsToSign}${apiSecret}`).digest("hex");

// A tiny 1x1 red PNG, base64-decoded, as the test upload payload.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const form = new FormData();
form.append("file", new Blob([new Uint8Array(tinyPng)]), "test.png");
form.append("api_key", apiKey);
form.append("timestamp", String(timestamp));
form.append("folder", folder);
form.append("signature", signature);

const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
  method: "POST",
  body: form,
});

console.log("HTTP status:", res.status);
const text = await res.text();
console.log("Response:", text);
