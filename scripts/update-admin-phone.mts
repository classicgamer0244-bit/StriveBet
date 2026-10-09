/**
 * Changes the login phone number of an existing admin/superadmin account.
 *
 * Usage (PowerShell), pointed at the target database for this terminal only:
 *   $env:DATABASE_URL="mongodb+srv://…"
 *   npx.cmd tsx scripts/update-admin-phone.mts
 *
 * Phones are stored the way the login form sends them: local digits without
 * the leading 0 (Ghana format, e.g. "0244123456" is stored as "244123456").
 * Shows the target database and requires confirmation; refuses the old
 * maxbett.site database and any number already used by another account.
 */
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL for this terminal first.");
  const target = url.match(/@([^/?]+)\/([^?]*)/);
  console.log(`\nTarget database: ${target?.[1] ?? "?"} / ${target?.[2] || "(default)"}`);
  if (/maxbet\.3pv3dcw\.mongodb\.net/i.test(url)) {
    throw new Error("That is the old maxbett.site database (from .env). Set DATABASE_URL to the new StriveBet database first.");
  }
  if ((await ask('Change an admin phone in THIS database? Type "yes" to continue: ')).toLowerCase() !== "yes") {
    console.log("Cancelled — nothing written.");
    return;
  }

  const db = new PrismaClient();
  try {
    const email = (await ask("Admin account email: ")).toLowerCase();
    const admin = await db.adminAccount.findUnique({ where: { email } });
    if (!admin) throw new Error(`No admin account with email ${email}.`);
    console.log(`Found: ${admin.displayName} (${admin.role}), current phone ${admin.phone}`);

    const raw = (await ask("New phone, local format (e.g. 0244123456): ")).replace(/\D/g, "");
    if (raw.length < 9 || raw.length > 10) {
      throw new Error("Enter a local number of 9-10 digits like 0244123456 — the login form adds +233 itself and accepts at most 10 digits.");
    }
    const phone = raw.startsWith("0") ? raw.slice(1) : raw;
    const variants = [phone, `0${phone}`];

    const [userClash, adminClash] = await Promise.all([
      db.user.findFirst({ where: { phone: { in: variants } } }),
      db.adminAccount.findFirst({ where: { phone: { in: variants }, NOT: { id: admin.id } } }),
    ]);
    if (userClash || adminClash) throw new Error("That phone number is already used by another account.");

    await db.adminAccount.update({ where: { id: admin.id }, data: { phone } });
    console.log(`\nDone. ${admin.displayName} now logs in with 0${phone} (or ${phone}) and the same password.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
