"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKET_TAB_KEYS, type Market, type MarketTabKey } from "@/types";
import { MARKET_TAB_LABELS } from "@/lib/constants";
import { MarketGroupList } from "./market-group";

type ActiveTab = "all" | MarketTabKey | "correct-score";

export function MarketTabs({
  markets,
  fixtureId,
  fixtureLabel,
}: {
  markets: Market[];
  fixtureId: string;
  fixtureLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("main");

  const tabsWithContent = MARKET_TAB_KEYS.filter((tab) => markets.some((m) => m.tab === tab));
  const hasCorrectScore = markets.some((m) => m.name === "Correct Score");

  const visibleMarkets =
    activeTab === "all"
      ? markets
      : activeTab === "correct-score"
      ? markets.filter((m) => m.name === "Correct Score")
      : markets.filter((m) => m.tab === activeTab);

  return (
    <div>
      <div className="overflow-x-auto overflow-y-hidden border-b border-border px-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList variant="line" className="h-auto gap-4 p-0 whitespace-nowrap w-max">
            <TabsTrigger value="all" className="px-1 py-2.5 text-sm font-semibold">
              {MARKET_TAB_LABELS.all}
            </TabsTrigger>
            {tabsWithContent.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="px-1 py-2.5 text-sm font-semibold">
                {MARKET_TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
            {hasCorrectScore && (
              <TabsTrigger value="correct-score" className="px-1 py-2.5 text-sm font-semibold">
                Correct Score
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>
      <MarketGroupList markets={visibleMarkets} fixtureId={fixtureId} fixtureLabel={fixtureLabel} />
    </div>
  );
}
