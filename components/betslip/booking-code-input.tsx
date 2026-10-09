"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBetslip } from "@/hooks/use-betslip";

interface LoadedSelection {
  fixtureId: string;
  fixtureLabel: string;
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  odds: number;
  available: boolean;
}

export function BookingCodeInput() {
  const [code, setCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const { toggleSelection } = useBetslip();

  async function handleLoad() {
    if (!code.trim()) {
      toast.error("Enter a booking code first.");
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(code.trim())}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? `Booking code "${code}" was not found.`);
        return;
      }

      const selections = (data.selections ?? []) as LoadedSelection[];
      const available = selections.filter((s) => s.available);
      const unavailable = selections.length - available.length;

      for (const s of available) {
        toggleSelection({
          fixtureId: s.fixtureId,
          fixtureLabel: s.fixtureLabel,
          marketId: s.marketId,
          marketName: s.marketName,
          selectionId: s.selectionId,
          selectionLabel: s.selectionLabel,
          odds: s.odds,
        });
      }

      if (available.length > 0) {
        toast.success(`Loaded ${available.length} selection${available.length === 1 ? "" : "s"} from booking code ${data.code}.`);
      }
      if (unavailable > 0) {
        toast.warning(`${unavailable} selection${unavailable === 1 ? "" : "s"} from that slip ${unavailable === 1 ? "is" : "are"} no longer available.`);
      }
      setCode("");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="py-2">
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[15px] font-bold text-foreground">
          Please insert booking code
        </p>
        <Info className="size-4 text-muted-foreground" />
      </div>
      <div className="flex">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Booking Code"
          className="h-11 rounded-r-none bg-background px-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="button"
          onClick={handleLoad}
          disabled={isBusy}
          className="h-11 rounded-l-none bg-success px-6 text-sm font-bold text-success-foreground hover:bg-success/90"
        >
          Load
        </Button>
      </div>
    </div>
  );
}
