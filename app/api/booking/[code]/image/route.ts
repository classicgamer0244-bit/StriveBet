import { db } from "@/lib/db";
import { renderSlipImage, formatSlipTimestamp } from "@/lib/slip-image";
import { getMultiBonusPercent } from "@/lib/betslip-labels";
import { marketDisplayName } from "@/lib/markets/market-label";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slip = await db.bookingSlip.findUnique({ where: { code: code.toUpperCase() } });
  if (!slip) return new Response("Not found", { status: 404 });

  const totalOdds = slip.selections.reduce((acc, s) => acc * s.oddsAtBooking, 1);

  return renderSlipImage({
    code: slip.code,
    legs: slip.selections.map((s) => ({
      fixtureLabel: s.fixtureLabel,
      marketLabel: marketDisplayName(s.marketName),
      selectionLabel: s.selectionLabel,
      odds: s.oddsAtBooking,
    })),
    totalOdds,
    bonusPercent: getMultiBonusPercent(slip.selections.length),
    timestamp: formatSlipTimestamp(new Date()),
  });
}
