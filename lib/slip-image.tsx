import { ImageResponse } from "next/og";
import { BRAND_NAME, CURRENCY } from "@/lib/constants";

export interface SlipImageLeg {
  fixtureLabel: string;
  marketLabel: string;
  selectionLabel: string;
  odds: number;
}

export interface SlipImageOptions {
  code: string;
  legs: SlipImageLeg[];
  totalOdds: number;
  /** Booking slips only — the multi-bet bonus % this selection count
   * qualifies for (see lib/betslip-labels.ts's getMultiBonusPercent).
   * Omitted for a placed bet's ticket, which has no bonus applied. */
  bonusPercent?: number;
  /** Placed-bet tickets only — a booking slip has no real stake yet. */
  stake?: number;
  potentialPayout?: number;
  timestamp: string;
}

const WIDTH = 900;
const ROW_HEIGHT = 158;
const MIN_HEIGHT = 950;
const MAX_HEIGHT = 2800;

const COLORS = {
  bg: "#0F1115",
  card: "#1A1D24",
  border: "#2A2E37",
  muted: "#9CA3AF",
  text: "#E5E7EB",
  brand: "#1F6BFF",
  brandTint: "rgba(203,41,87,0.14)",
  success: "#22C55E",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSlipTimestamp(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Shared by GET /api/bets/:id/image (a placed bet's ticket) and
 * GET /api/booking/:code/image (a saved-but-unstaked slip) — SportyBet-style
 * shareable card. ImageResponse (Satori) only supports flexbox and a CSS
 * subset, so every node below is explicitly `display: flex`. Height grows
 * with the selection count instead of a fixed canvas squishing everything. */
export function renderSlipImage(opts: SlipImageOptions) {
  const isBookingSlip = opts.stake === undefined;
  const EXAMPLE_STAKE = 100;
  const exampleGross = EXAMPLE_STAKE * opts.totalOdds;
  const exampleBonus = (exampleGross * (opts.bonusPercent ?? 0)) / 100;
  const exampleTotal = exampleGross + exampleBonus;

  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, 950 + opts.legs.length * 200));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.bg,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: COLORS.brand,
            padding: "32px 56px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: "white" }}>{BRAND_NAME}</div>
            <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Ghana</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "white" }}>
              {isBookingSlip ? "Betslip" : "Bet Ticket"}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
              {opts.timestamp}
            </div>
          </div>
        </div>

        {/* Code + stats */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 56px 32px" }}>
          <div style={{ display: "flex", fontSize: 24, color: COLORS.muted }}>
            {isBookingSlip ? "Booking Code" : "Ticket ID"}
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "white", marginTop: 6, letterSpacing: 2 }}>
            {opts.code}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              marginTop: 28,
              backgroundColor: COLORS.card,
              borderBottom: `4px solid ${COLORS.brand}`,
              padding: "22px 32px",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 28, color: COLORS.muted }}>Odds</div>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "white" }}>
                {opts.totalOdds.toFixed(2)}
              </div>
            </div>
            {isBookingSlip && opts.bonusPercent !== undefined && opts.bonusPercent > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", fontSize: 28, color: COLORS.muted }}>Max Bonus</div>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "white" }}>
                  {opts.bonusPercent.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Example Bet (booking slip) / Your Bet (placed ticket) */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.brand,
            backgroundColor: COLORS.brandTint,
            padding: "16px 56px",
          }}
        >
          {isBookingSlip ? "Example Bet" : "Your Bet"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: COLORS.bg,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 56px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 26, color: COLORS.text }}>Stake</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "white" }}>
              {fmtMoney(isBookingSlip ? EXAMPLE_STAKE : (opts.stake ?? 0))}
            </div>
          </div>
          {isBookingSlip && (opts.bonusPercent ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 56px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 26, color: COLORS.text }}>Bonus</div>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "white" }}>
                {fmtMoney(exampleBonus)}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 56px", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 26, color: COLORS.text }}>Payout</div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "white" }}>
              {fmtMoney(isBookingSlip ? exampleTotal : (opts.potentialPayout ?? 0))}
            </div>
          </div>
        </div>

        {/* Selections */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.brand,
            backgroundColor: COLORS.brandTint,
            padding: "16px 56px",
          }}
        >
          Selections
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: COLORS.bg, paddingBottom: 48 }}>
          {opts.legs.map((leg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px 56px",
                borderBottom: i < opts.legs.length - 1 ? `1px solid ${COLORS.border}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 16 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="m12 7-2.5-1.5L7 7v4l4 3 4-3V7z" />
                    <path d="M12 7V2" />
                    <path d="m16 11 4.5 1.5" />
                    <path d="M15.5 15.5 19 20" />
                    <path d="M8.5 15.5 5 20" />
                    <path d="m8 11-4.5 1.5" />
                  </svg>
                  <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "white" }}>
                    {leg.selectionLabel}
                  </div>
                </div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "white" }}>
                  {leg.odds.toFixed(2)}
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 24, color: COLORS.text, marginTop: 12 }}>{leg.fixtureLabel}</div>
              <div style={{ display: "flex", fontSize: 24, color: COLORS.muted, marginTop: 6 }}>{leg.marketLabel}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: WIDTH, height }
  );
}
