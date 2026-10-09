"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export function BetInsureCard() {
  const [flexi, setFlexi] = useState(false);
  const [oneCut, setOneCut] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-success">
        <ShieldCheck className="size-4" />
        MaxInsure
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <Checkbox checked={flexi} onCheckedChange={(v) => setFlexi(v === true)} />
          Flexi
        </label>
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <Checkbox checked={oneCut} onCheckedChange={(v) => setOneCut(v === true)} />
          One Cut
        </label>
      </div>
    </div>
  );
}
