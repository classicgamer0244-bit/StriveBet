/**
 * One-off migration: pay out demo-mode ("SIM") winnings as real balance.
 *
 * Context. Demo mode existed during development and was retired when the
 * platform went live. Because no screen ever showed which mode a bet was placed
 * in, and the betslip persisted the choice in localStorage indefinitely, some
 * genuine customers placed demo bets for days believing they were real — then
 * reported not being paid on wins of tens of thousands of cedis. Their balances
 * were correct; the wins simply weren't real. This script makes good on those
 * wins for the customers affected.
 *
 * Scope decisions (made by the platform owner, deliberately conservative):
 *
 *   - **Only accounts that have made a real gateway deposit.** Of the 25
 *     accounts holding winning SIM bets, 19 had never deposited a cedi — those
 *     are development/test accounts, and paying them would have moved GHS 10.2m
 *     of fictional money into live balances.
 *   - **Net, not gross.** A SIM bet never debited its stake, so crediting the
 *     full return would hand back a stake the player never funded. Crediting
 *     (payout − stake) matches exactly what the bet would have netted had it
 *     been real.
 *   - Bets where payout <= stake are skipped: there is no profit to pay.
 *
 * Idempotent. Every credit writes a Transaction with a deterministic
 * `simpayout_<betId>` reference, and `reference` is unique — so a second run
 * credits nothing. Each bet is credited inside a single interactive
 * transaction (ledger row + balance CAS together), the same all-or-nothing
 * guarantee normal settlement uses, so a crash can never leave a paid balance
 * with no record or vice versa.
 *
 * Usage:  npx tsx scripts/credit-sim-winnings.mts          (dry run, default)
 *         npx tsx scripts/credit-sim-winnings.mts --apply  (moves real money)
 */
import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const ghs = (minor: number) => `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  console.log(APPLY ? "=== APPLY MODE — this moves real money ===\n" : "=== DRY RUN — no changes will be made ===\n");

  const wonSimBets = await db.bet.findMany({ where: { mode: "SIM", status: "WON" }, orderBy: { placedAt: "asc" } });

  // "Genuine customer" = has at least one successful gateway deposit. `dep_` is
  // the initialize route's prefix; superadmin manual credits (`cred_`) and
  // earnings settlements (`settle_`) deliberately don't qualify, since neither
  // implies a real person funded this account.
  const accountIds = [...new Set(wonSimBets.map((b) => b.accountId))];
  const depositors = await db.transaction.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      type: "DEPOSIT",
      status: "SUCCESS",
      reference: { startsWith: "dep_" },
    },
    _sum: { amountMinor: true },
  });
  const depositedByAccount = new Map(depositors.map((d) => [d.accountId, d._sum.amountMinor ?? 0]));

  const alreadyPaid = new Set(
    (
      await db.transaction.findMany({
        where: { reference: { startsWith: "simpayout_" } },
        select: { reference: true },
      })
    ).map((t) => t.reference)
  );

  const eligible = wonSimBets.filter(
    (b) => depositedByAccount.has(b.accountId) && (b.payoutMinor ?? BigInt(0)) > b.stakeMinor && !alreadyPaid.has(`simpayout_${b.id}`)
  );

  // Phones for the ledger rows (Transaction.phone is required).
  const userIds = [...new Set(eligible.filter((b) => b.accountKind === "USER").map((b) => b.accountId))];
  const adminIds = [...new Set(eligible.filter((b) => b.accountKind === "ADMIN").map((b) => b.accountId))];
  const [users, admins] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true, email: true, balanceMinor: true } }) : [],
    adminIds.length ? db.adminAccount.findMany({ where: { id: { in: adminIds } }, select: { id: true, phone: true, balanceMinor: true } }) : [],
  ]);
  const accountById = new Map<string, { phone: string; email?: string | null; balanceMinor: number }>([
    ...users.map((u): [string, { phone: string; email?: string | null; balanceMinor: number }] => [u.id, u]),
    ...admins.map((a): [string, { phone: string; email?: string | null; balanceMinor: number }] => [a.id, { phone: a.phone, balanceMinor: a.balanceMinor }]),
  ]);

  const perAccount = new Map<string, { netMinor: number; bets: number }>();
  for (const b of eligible) {
    const net = Number(b.payoutMinor ?? BigInt(0)) - Number(b.stakeMinor);
    const e = perAccount.get(b.accountId) ?? { netMinor: 0, bets: 0 };
    e.netMinor += net;
    e.bets += 1;
    perAccount.set(b.accountId, e);
  }

  console.log(`winning SIM bets overall            : ${wonSimBets.length}`);
  console.log(`  ↳ on accounts with a real deposit : ${wonSimBets.filter((b) => depositedByAccount.has(b.accountId)).length}`);
  console.log(`  ↳ already credited by a prior run : ${wonSimBets.filter((b) => alreadyPaid.has(`simpayout_${b.id}`)).length}`);
  console.log(`  ↳ ELIGIBLE NOW                    : ${eligible.length} across ${perAccount.size} account(s)\n`);

  console.log("per-account payout:");
  let total = 0;
  for (const [accountId, e] of [...perAccount.entries()].sort((a, b) => b[1].netMinor - a[1].netMinor)) {
    const acc = accountById.get(accountId);
    total += e.netMinor;
    console.log(
      `  ${(acc?.phone ?? accountId).padEnd(16)} ${(acc?.email ?? "").padEnd(30)} bets=${String(e.bets).padStart(2)}  ` +
        `credit=${ghs(e.netMinor).padStart(18)}  balance ${ghs(acc?.balanceMinor ?? 0)} → ${ghs((acc?.balanceMinor ?? 0) + e.netMinor)}`
    );
  }
  console.log(`\nTOTAL TO CREDIT: ${ghs(total)}`);

  if (!APPLY) {
    console.log("\n(dry run — re-run with --apply to credit these accounts)");
    return;
  }

  console.log("\napplying…");
  let credited = 0;
  let creditedMinor = 0;
  for (const bet of eligible) {
    const net = Number(bet.payoutMinor ?? BigInt(0)) - Number(bet.stakeMinor);
    const acc = accountById.get(bet.accountId);
    try {
      await db.$transaction(
        async (tx) => {
          // The unique reference is the idempotency key: if a concurrent or
          // prior run already paid this bet, this insert throws P2002 and the
          // whole unit rolls back, crediting nothing.
          await tx.transaction.create({
            data: {
              accountId: bet.accountId,
              accountKind: bet.accountKind,
              type: "WINNING",
              status: "SUCCESS",
              amountMinor: net,
              method: "Demo bet winnings (goodwill payout)",
              phone: acc?.phone ?? "",
              reference: `simpayout_${bet.id}`,
              referringAdminId: bet.referringAdminId ?? undefined,
              note: `Demo-mode bet paid out as real: return ${ghs(Number(bet.payoutMinor ?? BigInt(0)))} less unfunded stake ${ghs(Number(bet.stakeMinor))}`,
            },
          });

          // Read-then-CAS rather than a blind increment: Mongo silently no-ops
          // an increment against a field absent from the document, which would
          // commit a ledger row asserting a payment that never happened.
          if (bet.accountKind === "ADMIN") {
            const row = await tx.adminAccount.findUnique({ where: { id: bet.accountId }, select: { balanceMinor: true } });
            if (!row) throw new Error(`admin account ${bet.accountId} missing`);
            const { count } = await tx.adminAccount.updateMany({
              where: { id: bet.accountId, balanceMinor: row.balanceMinor },
              data: { balanceMinor: { set: row.balanceMinor + net } },
            });
            if (count !== 1) throw new Error(`balance CAS lost for admin ${bet.accountId}`);
          } else {
            const row = await tx.user.findUnique({ where: { id: bet.accountId }, select: { balanceMinor: true } });
            if (!row) throw new Error(`user account ${bet.accountId} missing`);
            const { count } = await tx.user.updateMany({
              where: { id: bet.accountId, balanceMinor: row.balanceMinor },
              data: { balanceMinor: { set: row.balanceMinor + net } },
            });
            if (count !== 1) throw new Error(`balance CAS lost for user ${bet.accountId}`);
          }

          // Convert the bet to REAL so the books agree with the money: the
          // balance identity counts REAL bets only, and a paid-out bet still
          // reading SIM would look like an unexplained credit forever.
          //
          // stake and payout are left EXACTLY as they are. The identity is
          // (− stake + payout), which equals the net we just credited, so it
          // reconciles precisely — while the player's bet history still shows
          // the same stake and return they were shown when they won. Zeroing
          // the stake would also reconcile, but only by rewriting the history
          // they are about to be paid against.
          await tx.bet.update({
            where: { id: bet.id },
            data: { mode: "REAL", settlementSource: "sim_goodwill_payout" },
          });
        },
        { maxWait: 5_000, timeout: 15_000 }
      );
      credited += 1;
      creditedMinor += net;
      console.log(`  ✓ ${acc?.phone ?? bet.accountId} bet ${bet.id} credited ${ghs(net)}`);
    } catch (err) {
      const dup = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      console.error(`  ✗ bet ${bet.id}: ${dup ? "already credited (skipped)" : String(err)}`);
    }
  }
  console.log(`\nDONE — credited ${credited}/${eligible.length} bets, ${ghs(creditedMinor)} total`);
}

await main();
await db.$disconnect();
