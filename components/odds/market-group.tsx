"use client";

import { Info } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Market } from "@/types";
import { marketDisplayName } from "@/lib/markets/market-label";
import { OddsButton } from "./odds-button";
import { CorrectScoreGrid } from "./correct-score-grid";

export function MarketGroup({
  market,
  fixtureId,
  fixtureLabel,
}: {
  market: Market;
  fixtureId: string;
  fixtureLabel: string;
}) {
  return (
    <AccordionItem value={market.id} className="border-b border-border px-4">
      <AccordionTrigger className="text-sm font-semibold text-foreground [&_svg]:text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {marketDisplayName(market.name)}
          {market.info && <Info className="size-3.5 text-muted-foreground" aria-label={market.info} />}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {market.name === "Correct Score" ? (
          <div className="pb-3">
            <CorrectScoreGrid market={market} fixtureId={fixtureId} fixtureLabel={fixtureLabel} />
          </div>
        ) : (
          <div
            className="grid gap-1.5 pb-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(market.selections.length, 3)}, 1fr)` }}
          >
            {market.selections.map((selection) => (
              <OddsButton
                key={selection.id}
                fixtureId={fixtureId}
                fixtureLabel={fixtureLabel}
                marketId={market.id}
                marketName={market.name}
                selection={selection}
                className="rounded-sm"
              />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function MarketGroupList({
  markets,
  fixtureId,
  fixtureLabel,
}: {
  markets: Market[];
  fixtureId: string;
  fixtureLabel: string;
}) {
  if (markets.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No markets available for this category yet.
      </p>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={markets.slice(0, 6).map((m) => m.id)}>
      {markets.map((market) => (
        <MarketGroup key={market.id} market={market} fixtureId={fixtureId} fixtureLabel={fixtureLabel} />
      ))}
    </Accordion>
  );
}
