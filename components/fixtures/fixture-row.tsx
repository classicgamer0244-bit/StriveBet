"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Fixture } from "@/types";
import { OddsButton } from "@/components/odds/odds-button";
import { LiveBadge } from "./live-badge";
import { formatKickoffTime } from "@/lib/format-date";
import { GoalsLineSelect, type GoalsLine } from "./goals-line-select";
import { getMainMarket, getMainTotalMarket } from "@/lib/markets/main-market";

export function FixtureRow({
  fixture,
  showGoalsColumn = false,
  dark = false,
}: {
  fixture: Fixture;
  showGoalsColumn?: boolean;
  dark?: boolean;
}) {
  const [goalsLine, setGoalsLine] = useState<GoalsLine>("2.5");

  const fixtureLabel = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
  const isFootball = fixture.sportSlug === "football";
  // Football: 1X2 + a per-row goals line. Other sports: their own winner
  // market + the bookmaker's main total line (lib/markets/main-market.ts).
  const mainMarket = getMainMarket(fixture);
  const goalsMarket = isFootball
    ? fixture.markets.find((m) => m.name === `Total ${goalsLine}`)
    : getMainTotalMarket(fixture);
  const totalLine = goalsMarket?.name.split(" ").pop();
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const otherMarketsCount = Math.max(0, fixture.markets.length - (mainMarket ? 1 : 0) - (showGoalsColumn && goalsMarket ? 1 : 0));

  const rowBorder = dark ? "border-white/10" : "border-border";
  const teamText = dark ? "text-white group-hover:text-volt" : "text-foreground group-hover:text-primary";
  const mutedText = dark ? "text-white/40" : "text-muted-foreground";
  const moreLink = dark ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-volt" : "bg-muted text-foreground/70 hover:bg-primary hover:text-white";

  return (
    <div className={`flex min-w-[720px] items-center gap-3 border-b ${rowBorder} px-4 py-2.5 transition-colors last:border-b-0 ${dark ? "hover:bg-white/[0.03]" : "hover:bg-muted/40"}`}>
      {/* Time / minute */}
      <div className="w-16 shrink-0 text-xs">
        {isLive ? (
          <div className="flex flex-col gap-1">
            <span className="font-bold text-live tabular-nums">{fixture.minute}</span>
            <span className={mutedText}>{fixture.period}</span>
            <LiveBadge />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className={`text-sm font-extrabold tabular-nums ${dark ? "text-white" : "text-foreground"}`}>
              {formatKickoffTime(fixture.kickoffAt)}
            </span>
            <span className={`text-[10px] tabular-nums ${mutedText}`}>ID {fixture.gameId}</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <Link href={`/sports/${fixture.id}`} className="min-w-[9rem] flex-1 group">
        <div className={`flex flex-col gap-1 text-sm font-semibold transition-colors ${teamText}`}>
          <span className="truncate">{fixture.homeTeam.name}</span>
          <span className="truncate">{fixture.awayTeam.name}</span>
        </div>
      </Link>

      {/* Score */}
      {isLive && fixture.score && (
        <div className={`flex w-6 shrink-0 flex-col gap-1 text-sm font-extrabold tabular-nums ${dark ? "text-volt" : "text-primary"}`}>
          <span>{fixture.score.home}</span>
          <span>{fixture.score.away}</span>
        </div>
      )}

      {/* Main market (1X2, or a 2-way winner with an empty middle cell so it
          still lines up under the 1 / X / 2 column header) */}
      <div className="flex w-52 shrink-0 gap-1.5">
        {mainMarket ? (
          <>
            {mainMarket.selections.map((s, i) => (
              <span key={s.id} className="contents">
                {mainMarket.selections.length === 2 && i === 1 && (
                  <span className={`flex min-h-9 flex-1 items-center justify-center rounded-lg text-xs ${mutedText}`}>-</span>
                )}
                <OddsButton
                  variant="compact"
                  fixtureId={fixture.id}
                  fixtureLabel={fixtureLabel}
                  marketId={mainMarket.id}
                  marketName={mainMarket.name}
                  selection={s}
                  dark={dark}
                  className="flex-1"
                />
              </span>
            ))}
          </>
        ) : (
          <span className={`flex min-h-9 flex-1 items-center justify-center rounded-lg border border-dashed text-[11px] font-semibold ${dark ? "border-white/10" : "border-border"} ${mutedText}`}>
            Odds not available
          </span>
        )}
      </div>

      {/* Goals market — each row picks its own line independently */}
      {showGoalsColumn && (
        <div className="flex w-56 shrink-0 items-center gap-1.5">
          {isFootball ? (
            <GoalsLineSelect value={goalsLine} onChange={setGoalsLine} dark={dark} />
          ) : (
            <span className={`flex h-9 w-20 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${dark ? "bg-white/5 text-white/70" : "bg-muted text-foreground/70"}`}>
              {totalLine ?? "-"}
            </span>
          )}
          {goalsMarket?.selections.map((s) => (
            <OddsButton
              key={s.id}
              variant="compact"
              fixtureId={fixture.id}
              fixtureLabel={fixtureLabel}
              marketId={goalsMarket.id}
              marketName={goalsMarket.name}
              selection={s}
              dark={dark}
            />
          ))}
        </div>
      )}

      {/* More markets */}
      <Link href={`/sports/${fixture.id}`} className={`flex h-9 shrink-0 items-center gap-0.5 rounded-lg px-2 text-xs font-bold transition-colors ${moreLink}`}>
        +{otherMarketsCount}
        <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}
