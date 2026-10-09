import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { renderSlipImage, formatSlipTimestamp } from "@/lib/slip-image";
import { fromMinor } from "@/lib/money";
import { marketDisplayName } from "@/lib/markets/market-label";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requirePlayerAccount();
  if (!account) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const bet = await db.bet.findUnique({ where: { id } });
  if (!bet || bet.accountId !== account.id) return new Response("Not found", { status: 404 });

  return renderSlipImage({
    code: bet.id.slice(-8).toUpperCase(),
    legs: bet.legs.map((leg) => ({
      fixtureLabel: leg.fixtureLabel,
      marketLabel: leg.marketLabel ?? marketDisplayName(leg.marketName),
      selectionLabel: leg.selectionLabel,
      odds: leg.odds,
    })),
    totalOdds: bet.totalOdds,
    stake: fromMinor(Number(bet.stakeMinor)),
    potentialPayout: fromMinor(Number(bet.payoutMinor ?? bet.potentialPayoutMinor)),
    timestamp: formatSlipTimestamp(bet.placedAt),
  });
}
