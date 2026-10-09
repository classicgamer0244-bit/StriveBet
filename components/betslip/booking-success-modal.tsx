"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Ticket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface BookingSuccessInfo {
  code: string;
  count: number;
  totalOdds: number;
  expiresAt: string;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Shown after "Book Bet" — the code (with a copy button) plus a "Save
 * image" action that always downloads the generated slip image directly,
 * never the OS share sheet (that's a deliberate choice, not an oversight). */
export function BookingSuccessModal({
  info,
  onOpenChange,
}: {
  info: BookingSuccessInfo | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function copyCode() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — select and copy the code manually.");
    }
  }

  async function saveImage() {
    if (!info) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/booking/${info.code}/image`);
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `strivebet-${info.code}.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success("Image saved.");
    } catch {
      toast.error("Couldn't save the image right now.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={info !== null} onOpenChange={onOpenChange}>
      <DialogContent className="text-center sm:max-w-sm">
        <DialogHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <Ticket className="size-7" />
          </div>
          <DialogTitle className="text-xl">Betslip Saved!</DialogTitle>
          <DialogDescription>Share this code or load it on any device to place this bet later.</DialogDescription>
        </DialogHeader>

        {info && (
          <>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="text-2xl font-extrabold tracking-widest text-foreground">{info.code}</span>
              {copied ? <Check className="size-5 shrink-0 text-success" /> : <Copy className="size-5 shrink-0 text-muted-foreground" />}
            </button>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {info.count} selection{info.count === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>Total odds {info.totalOdds.toFixed(2)}</span>
              <span>·</span>
              <span>Valid until {formatExpiry(info.expiresAt)}</span>
            </div>
          </>
        )}

        <DialogFooter className="sm:flex-col">
          <Button onClick={saveImage} disabled={!info || isSaving} className="w-full gap-1.5">
            <Download className="size-4" />
            {isSaving ? "Saving…" : "Save image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
