import crypto from "crypto";

function requireConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured.");
  }
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Uploads a single image to Cloudinary via their signed Upload API (raw
 * fetch, no SDK — same convention as lib/payments-service.ts and lib/arkesel.ts).
 * Returns the resulting public HTTPS URL.
 */
export async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "maxbet/team-logos";
  // Cloudinary's signature: sort the params to be signed alphabetically,
  // join as key=value&key=value, append the api secret directly, SHA-1 hash.
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(`${paramsToSign}${apiSecret}`).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary upload succeeded but returned no URL.");
  return data.secure_url;
}
