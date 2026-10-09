import { db } from "@/lib/db";

/** Singleton document — creates it on first read if missing, so a fresh
 * database (before the seed script runs) still has a sane default. */
export async function getPlatformSettings() {
  const existing = await db.platformSettings.findFirst();
  if (existing) return existing;
  return db.platformSettings.create({ data: {} });
}
