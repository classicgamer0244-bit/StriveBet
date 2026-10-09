"use client";

import { useState } from "react";
import type { Fixture } from "@/types";
import { groupFixturesByLeague } from "@/data/selectors";
import { MobileMarketViewTabs, type MarketViewKey } from "./mobile-market-view-tabs";
import { MobileFixtureRow } from "./mobile-fixture-row";
import { EmptyState } from "@/components/common/empty-state";

const VIEW_LABELS: Record<MarketViewKey, [string, string, string]> = {
  "1x2":      ["1", "X", "2"],
  "ou":       ["Over", "-", "Under"],
  "dc":       ["1X", "12", "X2"],
  "1st-half": ["1", "X", "2"],
  "handicap": ["1", "X", "2"],
};

function DateLabelBar({ fixtures, marketView, dark, hideDate = false }: { fixtures: Fixture[]; marketView: MarketViewKey; dark: boolean; hideDate?: boolean }) {
  const first = fixtures[0];
  const date = first ? new Date(first.kickoffAt) : new Date();
  const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "numeric" });
  const dayStr = date.toLocaleDateString("en-GB", { weekday: "long" });
  const labels = VIEW_LABELS[marketView];
  const mutedText = dark ? "text-white/40" : "text-muted-foreground";
  const bg = dark ? "border-white/10 bg-white/5" : "border-border bg-muted/40";

  return (
    <div className={`flex items-center justify-between border-b px-3 py-1.5 ${bg}`}>
      {!hideDate ? (
        <span className={`text-[11px] font-bold ${mutedText}`}>{dateStr} {dayStr}</span>
      ) : (
        <span />
      )}
      <div className="flex gap-1.5">
        {labels.map((l) => (
          <span key={l} className={`w-12 text-center text-[11px] font-bold ${mutedText}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export function MobileFixtureList({ fixtures, dark = false, hideDateLabel = false }: { fixtures: Fixture[]; dark?: boolean; hideDateLabel?: boolean }) {
  const [marketView, setMarketView] = useState<MarketViewKey>("1x2");

  if (fixtures.length === 0) {
    return <EmptyState title="No fixtures to show" description="Try a different filter." />;
  }

  const groups = groupFixturesByLeague(fixtures);

  return (
    <div>
      <MobileMarketViewTabs value={marketView} onChange={setMarketView} dark={dark} />
      <DateLabelBar fixtures={fixtures} marketView={marketView} dark={dark} hideDate={hideDateLabel} />
      {groups.map((group) => (
        <div key={group.leagueId}>
          <div className={dark ? "bg-white/5 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white/40 uppercase" : "bg-muted/60 px-3 py-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"}>
            {group.leagueName}
          </div>
          {group.fixtures.map((fixture) => (
            <MobileFixtureRow key={fixture.id} fixture={fixture} marketView={marketView} dark={dark} />
          ))}
        </div>
      ))}
    </div>
  );
}
