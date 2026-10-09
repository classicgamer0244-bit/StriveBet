import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creditBalanceChecked } from "@/lib/accounts/balance";
import type { Bet } from "@prisma/client";
import type { BetSettlementResult } from "./settle-bet";

/**
 * Settles ONE bet as a single all-or-nothing unit.
 *
 * ## Why this exists
 *
 * Settlement used to be three independent round trips — mark the bet WON, credit
 * the balance, write the ledger row. A process killed between the first two (a
 * 60s serverless request ceiling, an expired job lease, a transient Mongo error)
 * left the bet permanently WON with a payout recorded and the money never paid.
 * And because the bet was no longer OPEN, every automated recovery path was
 * blind to it: settleBetsForFixtures only loads OPEN bets, so nothing would ever
 * look at it again. The player simply never got paid, silently, forever.
 *
 * One interactive transaction removes that window entirely. MongoDB Atlas is a
 * replica set, so Prisma interactive transactions are available here.
 *
 * ## The invariant
 *
 *   a `win_<betId>` / `void_<betId>` ledger row exists  ⟺  the balance was credited
 *
 * Enforced by Transaction.reference's unique index INSIDE the transaction, not
 * by statement ordering. That equivalence is what lets the reconciler treat a
 * ledger row as hard proof of payment.
 *
 * ## Why the retry is safe
 *
 * MongoDB reports transient write conflicts as P2034 and Prisma does not retry
 * them automatically. We do, up to RETRYABLE_ATTEMPTS times. That is only safe
 * because of the two guards below, and removing either one turns this into a
 * double-credit engine:
 *
 *   1. the bet CAS (`where: { id, status: "OPEN" }`) matches nothing on a
 *      re-run of an already-committed transaction, and
 *   2. the unique `reference` makes the ledger insert throw P2002 instead.
 *
 * P2002 and P2025 are therefore NEVER retried — they are semantic answers
 * ("someone already owns this payout" / "that account is gone"), not transient
 * faults.
 */

/** Attempts for transient (P2034/P2028) failures only. */
const RETRYABLE_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 50;

/** Generous vs. the three small writes inside, but well under MongoDB's own
 * 60s transactionLifetimeLimitSeconds ceiling on Atlas. `maxWait` is how long
 * we'll queue for a pool connection — see SETTLE_CONCURRENCY's comment in
 * settle-bets-for-fixtures.ts for why that matters. */
const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

function isTransient(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2034: write conflict / deadlock. P2028: could not start a transaction
  // (pool exhaustion) — both resolve on their own given another moment.
  return err.code === "P2034" || err.code === "P2028";
}

function isAlreadyOwned(err: unknown): boolean {
  // P2002 on `reference`: another process already created this payout's ledger
  // row, so it already credited (or is mid-credit). Not our payout to make.
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SettleOutcome = "settled" | "already_settled" | "failed";

export interface SettleOneBetInput {
  bet: Bet;
  settlement: BetSettlementResult;
  /** Legs with `result` and the frozen final/halftime scores filled in. */
  updatedLegs: Bet["legs"];
  /** Pre-generated OUTSIDE the transaction — it does several sequential finds
   * of its own, which would hold the transaction (and a pool connection) open
   * far longer than the three writes here need. */
  verificationCode?: string;
  /** Transaction.phone is required and Bet carries none; bulk-prefetched by the
   * caller for the whole batch. */
  phone: string;
  /** Audit only — set for settlements that didn't come from the normal path
   * (e.g. "auto_void_overdue"). */
  settlementSource?: string;
}

export async function settleOneBet(input: SettleOneBetInput): Promise<SettleOutcome> {
  const { bet, settlement, updatedLegs, verificationCode, phone, settlementSource } = input;

  for (let attempt = 1; attempt <= RETRYABLE_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // 1. Claim the bet. The status guard is the primary idempotency key:
        //    only one caller can ever move it off OPEN.
        const { count } = await tx.bet.updateMany({
          where: { id: bet.id, status: "OPEN" },
          data: {
            status: settlement.status,
            payoutMinor: settlement.payoutMinor,
            settledAt: new Date(),
            legs: updatedLegs,
            ...(verificationCode ? { verificationCode } : {}),
            ...(settlementSource ? { settlementSource } : {}),
            // Clear any overdue flag — it just resolved.
            reviewFlaggedAt: null,
            reviewReason: null,
          },
        });
        if (count === 0) return "already_settled" as const;

        // SIM bets and zero payouts (a LOST bet) move no money and get no
        // ledger row — there is nothing to reconcile for them.
        if (bet.mode !== "REAL" || settlement.payoutMinor <= 0) return "settled" as const;

        // 2. Take ownership of the payout. The unique `reference` is what makes
        //    this the cross-process mutual exclusion between live settlement,
        //    the overdue sweep and the reconciler.
        await tx.transaction.create({
          data: {
            accountId: bet.accountId,
            accountKind: bet.accountKind,
            type: settlement.status === "WON" ? "WINNING" : "REFUND",
            status: "SUCCESS",
            amountMinor: settlement.payoutMinor,
            method: settlement.status === "WON" ? "Bet winnings" : "Void bet — stake returned",
            phone,
            reference: `${settlement.status === "WON" ? "win" : "void"}_${bet.id}`,
            referringAdminId: bet.referringAdminId ?? undefined,
          },
        });

        // 3. Move the money. Throws rather than silently no-opping.
        await creditBalanceChecked(
          tx,
          bet.accountKind === "ADMIN" ? "admin" : "user",
          bet.accountId,
          settlement.payoutMinor
        );

        return "settled" as const;
      }, TX_OPTIONS);
    } catch (err) {
      if (isAlreadyOwned(err)) {
        // The ledger row already exists ⇒ by the invariant above, this payout
        // was already credited. The bet-status write rolled back with it, so
        // the row's owner is responsible for it; nothing left to do.
        console.warn(`settlement: payout for bet ${bet.id} is already owned by another writer`);
        return "already_settled";
      }
      if (isTransient(err) && attempt < RETRYABLE_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt * attempt);
        continue;
      }
      console.error(`settlement failed for bet ${bet.id} (attempt ${attempt}):`, err);
      return "failed";
    }
  }

  return "failed";
}
