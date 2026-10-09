import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Fixture } from "@/types";
import { OddsButton } from "@/components/odds/odds-button";
import { formatKickoffTime } from "@/lib/format-date";
import { marketNameForView, type MarketViewKey } from "./mobile-market-view-tabs";
import { getMainMarket } from "@/lib/markets/main-market";

export function MobileFixtureRow({
  fixture,
  marketView,
  dark = false,
}: {
  fixture: Fixture;
  marketView: MarketViewKey;
  dark?: boolean;
}) {
  const fixtureLabel = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
  // The market-view tabs (1X2 / O/U / DC / …) are football markets; every
  // other sport always shows its own main winner market.
  const market =
    fixture.sportSlug === "football"
      ? fixture.markets.find((m) => m.name === marketNameForView(marketView))
      : getMainMarket(fixture);
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const otherMarketsCount = fixture.markets.length - (market ? 1 : 0);

  const mutedText = dark ? "text-white/40" : "text-muted-foreground";
  const teamText = dark ? "text-white" : "text-foreground";

  return (
    <Link
      href={`/sports/${fixture.id}`}
      className={`block border-b px-3 py-3 last:border-b-0 ${dark ? "border-white/10" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {isLive ? (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[11px] font-bold text-live">{fixture.minute}</span>
              <span className="text-[11px] font-semibold text-live">{fixture.period}</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {fixture.isHighlight && (
                <span className="flex items-center gap-1 rounded-sm bg-success px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-success-foreground">
                  Hot
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${dark ? "bg-white/10 text-white" : "bg-navy text-white"}`}>
                {formatKickoffTime(fixture.kickoffAt)}
              </span>
              <span className={`text-[11px] ${mutedText}`}>ID {fixture.gameId}</span>
            </div>
          )}
          <p className={`truncate text-[11px] font-medium ${mutedText}`}>{fixture.leagueName}</p>
        </div>
      </div>

      {isLive ? (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
            <div className="flex items-center justify-between pr-2">
              <p className={`truncate text-xs font-semibold ${teamText}`}>{fixture.homeTeam.name}</p>
              {fixture.score && (
                <span className={`ml-3 text-xs font-bold tabular-nums ${teamText}`}>{fixture.score.home}</span>
              )}
            </div>
            <div className="flex items-center justify-between pr-2">
              <p className={`truncate text-xs font-semibold ${teamText}`}>{fixture.awayTeam.name}</p>
              {fixture.score && (
                <span className={`ml-3 text-xs font-bold tabular-nums ${teamText}`}>{fixture.score.away}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {market?.selections.map((s) => (
              <OddsButton
                key={s.id}
                variant="compact"
                fixtureId={fixture.id}
                fixtureLabel={fixtureLabel}
                marketId={market.id}
                marketName={market.name}
                selection={s}
                dark={dark}
                className="min-w-16 h-9 rounded-lg"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
            <p className={`truncate text-[13px] font-semibold ${teamText}`}>{fixture.homeTeam.name}</p>
            <p className={`truncate text-[13px] font-semibold ${teamText}`}>{fixture.awayTeam.name}</p>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-1.5">
            {market?.selections.map((s) => (
              <OddsButton
                key={s.id}
                variant="compact"
                fixtureId={fixture.id}
                fixtureLabel={fixtureLabel}
                marketId={market.id}
                marketName={market.name}
                selection={s}
                dark={dark}
                className="w-16 h-9 rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1">
        <span className={`text-[11px] font-semibold ${mutedText}`}>+{otherMarketsCount}</span>
        <ChevronRight className={`size-3.5 ${mutedText}`} />
      </div>
    </Link>
  );
}
