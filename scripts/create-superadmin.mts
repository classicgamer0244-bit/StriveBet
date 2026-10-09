/**
 * Creates the head-office SUPERADMIN account in a fresh database — the safe
 * replacement for prisma/seed.ts on a real deployment (the seed creates demo
 * accounts that all share one known password).
 *
 * Usage (PowerShell), pointed at the target database for this terminal only:
 *   $env:DATABASE_URL="mongodb+srv://…"
 *   npx.cmd tsx scripts/create-superadmin.mts
 *
 * Prompts for name, email, phone and password (password input is hidden and
 * never echoed or stored in shell history). Shows the target database host and
 * requires confirmation before writing anything. Refuses if the phone or email
 * is already registered, or if a superadmin already exists (unless --force).
 */
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { PrismaClient } from "@prisma/client";

const generateReferralCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

/** Reads a line without echoing what's typed. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u0008" || c === "\u007f") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL for this terminal first (see the usage note at the top of this file).");
  const target = url.match(/@([^/?]+)\/([^?]*)/);
  console.log(`\nTarget database: ${target?.[1] ?? "?"} / ${target?.[2] || "(default)"}`);
  // The local .env points at maxbett.site's live database, and it gets picked
  // up whenever DATABASE_URL isn't set in the terminal — never write there.
  if (/maxbet\.3pv3dcw\.mongodb\.net/i.test(url)) {
    throw new Error(
      "That is the old maxbett.site database (from .env). Set DATABASE_URL to the new StiveBet database in this terminal first."
    );
  }
  if ((await ask('Create the superadmin in THIS database? Type "yes" to continue: ')).toLowerCase() !== "yes") {
    console.log("Cancelled — nothing written.");
    return;
  }

  const db = new PrismaClient();
  try {
    const force = process.argv.includes("--force");
    const existing = await db.adminAccount.count({ where: { role: "SUPERADMIN" } });
    if (existing > 0 && !force) {
      console.log(`This database already has ${existing} superadmin account(s). Re-run with --force to add another.`);
      return;
    }

    const displayName = (await ask("Display name (e.g. StiveBet HQ): ")) || "StiveBet HQ";
    const email = (await ask("Email: ")).toLowerCase();
    const rawPhone = (await ask("Phone, local format (used to log in, e.g. 0244123456): ")).replace(/\D/g, "");
    // The login form adds +233 itself and accepts at most 10 digits, so only a
    // local-format number can ever be typed in to match.
    if (rawPhone.length < 9 || rawPhone.length > 10) {
      throw new Error("Enter a local number of 9-10 digits like 0244123456 (no +country code).");
    }
    const phone = rawPhone.startsWith("0") ? rawPhone.slice(1) : rawPhone; // stored without the leading 0, like every account
    if (!email.includes("@")) throw new Error("Please enter a valid email.");

    const password = await askHidden("Password (min 10 characters, hidden): ");
    if (password.length < 10) throw new Error("Password must be at least 10 characters.");
    if ((await askHidden("Repeat password: ")) !== password) throw new Error("Passwords didn't match.");

    const phoneTaken = await Promise.all([
      db.user.findFirst({ where: { phone: { in: [phone, `0${phone}`] } } }),
      db.adminAccount.findFirst({ where: { OR: [{ phone: { in: [phone, `0${phone}`] } }, { email }] } }),
    ]);
    if (phoneTaken.some(Boolean)) throw new Error("That phone number or email is already registered.");

    let referralCode = generateReferralCode();
    for (let i = 0; i < 5 && (await db.adminAccount.findUnique({ where: { referralCode } })); i++) {
      referralCode = generateReferralCode();
    }

    const admin = await db.adminAccount.create({
      data: {
        displayName,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        referralCode,
        role: "SUPERADMIN",
        status: "ACTIVE",
      },
    });

    if (!(await db.platformSettings.findFirst())) {
      await db.platformSettings.create({ data: {} });
    }

    console.log(`\nSuperadmin created: ${admin.displayName} (${admin.email}).`);
    console.log("Log in on the site with that phone number and password, then use the StiveBet logo link to reach /superadmin.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
