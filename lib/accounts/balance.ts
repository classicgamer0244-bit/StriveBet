import { db } from "@/lib/db";
import { PENALTY_DEPOSIT_FRACTION } from "@/lib/constants";
import type { AccountKind, Prisma } from "@prisma/client";

type Kind = "user" | "admin";

function toAccountKind(kind: Kind): AccountKind {
  return kind === "admin" ? "ADMIN" : "USER";
}

/** Credits a player or staff wallet — used for deposits and refunds. Settlement
 * payouts use creditBalanceChecked() below instead; see why there. */
export async function incrementBalance(kind: Kind, id: string, deltaMinor: number): Promise<void> {
  if (deltaMinor === 0) return;
  if (kind === "user") {
    await db.user.update({ where: { id }, data: { balanceMinor: { increment: deltaMinor } } });
  } else {
    await db.adminAccount.update({ where: { id }, data: { balanceMinor: { increment: deltaMinor } } });
  }
}

/** Thrown when a balance write cannot be proven to have applied. Always aborts
 * the surrounding transaction — never swallowed. */
export class BalanceWriteError extends Error {}

/**
 * Credits a wallet inside an interactive transaction, using a compare-and-set
 * on the CURRENT value instead of a blind `{ increment }`.
 *
 * This is not defensive padding — it closes a real, silent money-loss hole.
 * Mongo's connector no-ops an increment against a field that is entirely absent
 * from the document (the same quirk recordSuccessfulDeposit() below documents
 * and works around). A blind increment therefore reports success while moving
 * nothing, and inside a settlement transaction that is worse than useless: the
 * transaction commits, the ledger row is written asserting the player was paid,
 * and the account is short with no evidence anything went wrong. The CAS turns
 * that silent loss into a loud abort — an absent or concurrently-changed field
 * simply fails the predicate, `count` comes back 0, and the whole settlement
 * rolls back to be retried.
 *
 * Read-then-CAS is safe here precisely BECAUSE it runs inside a transaction:
 * any interleaving write fails the predicate rather than being lost.
 */
export async function creditBalanceChecked(
  tx: Prisma.TransactionClient,
  kind: Kind,
  id: string,
  deltaMinor: number
): Promise<void> {
  if (deltaMinor === 0) return;

  if (kind === "user") {
    const row = await tx.user.findUnique({ where: { id }, select: { balanceMinor: true } });
    if (!row) throw new BalanceWriteError(`no user account ${id} to credit`);
    const { count } = await tx.user.updateMany({
      where: { id, balanceMinor: row.balanceMinor },
      data: { balanceMinor: { set: row.balanceMinor + deltaMinor } },
    });
    if (count !== 1) throw new BalanceWriteError(`balance CAS lost for user ${id}`);
    return;
  }

  const row = await tx.adminAccount.findUnique({ where: { id }, select: { balanceMinor: true } });
  if (!row) throw new BalanceWriteError(`no admin account ${id} to credit`);
  const { count } = await tx.adminAccount.updateMany({
    where: { id, balanceMinor: row.balanceMinor },
    data: { balanceMinor: { set: row.balanceMinor + deltaMinor } },
  });
  if (count !== 1) throw new BalanceWriteError(`balance CAS lost for admin ${id}`);
}

/** Atomically debits a player or staff wallet only if the balance still
 * covers the amount — guards against a double-submit racing the same
 * balance check, used for both staking and withdrawals. */
export async function decrementBalanceIfSufficient(kind: Kind, id: string, amountMinor: number): Promise<boolean> {
  if (kind === "user") {
    const { count } = await db.user.updateMany({
      where: { id, balanceMinor: { gte: amountMinor } },
      data: { balanceMinor: { decrement: amountMinor } },
    });
    return count > 0;
  }
  const { count } = await db.adminAccount.updateMany({
    where: { id, balanceMinor: { gte: amountMinor } },
    data: { balanceMinor: { decrement: amountMinor } },
  });
  return count > 0;
}

/** Call once a deposit is confirmed successful (after incrementBalance) —
 * advances the "N deposits since last refund" counter withdrawal
 * eligibility is gated on, and clears the 8%-of-balance penalty flag if
 * this deposit is large enough (checked against balance BEFORE this
 * deposit's own credit, so the deposit has to stand on its own merit). */
export async function recordSuccessfulDeposit(kind: Kind, id: string, amountMinor: number): Promise<void> {
  if (kind === "user") {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return;
    const clearsPenalty = Boolean(user.penaltyDepositRequired) && amountMinor >= user.balanceMinor * PENALTY_DEPOSIT_FRACTION;
    await db.user.update({
      where: { id },
      // A plain `set` of a JS-computed value, not Prisma's `{ increment }` —
      // Mongo's connector silently no-ops an increment against a field
      // that's entirely absent from the document (nullable fields on
      // pre-existing accounts), unlike raw MongoDB's $inc.
      data: {
        depositsSinceReset: (user.depositsSinceReset ?? 0) + 1,
        ...(clearsPenalty ? { penaltyDepositRequired: false } : {}),
      },
    });
    return;
  }

  const admin = await db.adminAccount.findUnique({ where: { id } });
  if (!admin) return;
  const clearsPenalty = Boolean(admin.penaltyDepositRequired) && amountMinor >= admin.balanceMinor * PENALTY_DEPOSIT_FRACTION;
  await db.adminAccount.update({
    where: { id },
    data: {
      depositsSinceReset: (admin.depositsSinceReset ?? 0) + 1,
      ...(clearsPenalty ? { penaltyDepositRequired: false } : {}),
    },
  });
}

const REFUNDS_PER_PENALTY_CYCLE = 2;

/** Call whenever a superadmin refunds a withdrawal — resets the deposit
 * counter to 0 (a refunded withdrawal means the eligibility earned before
 * it no longer counts), and every 2nd refund in a row additionally flags
 * the account as needing an 8%-of-balance deposit before it can withdraw
 * again (see recordSuccessfulDeposit for where that flag gets cleared). */
export async function registerWithdrawalRefund(kind: Kind, id: string): Promise<void> {
  if (kind === "user") {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return;
    const refundsSincePenalty = (user.refundsSincePenalty ?? 0) + 1;
    const triggersPenalty = refundsSincePenalty >= REFUNDS_PER_PENALTY_CYCLE;
    await db.user.update({
      where: { id },
      data: {
        // When the penalty triggers, depositsSinceReset is irrelevant —
        // only the 8% deposit is required, not the 3-deposit count.
        // Only reset the counter on non-penalty refunds.
        ...(!triggersPenalty ? { depositsSinceReset: 0 } : {}),
        refundsSincePenalty: triggersPenalty ? 0 : refundsSincePenalty,
        ...(triggersPenalty ? { penaltyDepositRequired: true } : {}),
      },
    });
    return;
  }

  const admin = await db.adminAccount.findUnique({ where: { id } });
  if (!admin) return;
  const refundsSincePenalty = (admin.refundsSincePenalty ?? 0) + 1;
  const triggersPenalty = refundsSincePenalty >= REFUNDS_PER_PENALTY_CYCLE;
  await db.adminAccount.update({
    where: { id },
    data: {
      ...(!triggersPenalty ? { depositsSinceReset: 0 } : {}),
      refundsSincePenalty: triggersPenalty ? 0 : refundsSincePenalty,
      ...(triggersPenalty ? { penaltyDepositRequired: true } : {}),
    },
  });
}

export { toAccountKind };
