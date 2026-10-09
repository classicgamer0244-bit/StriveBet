"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_COMMISSION_SHARE } from "@/lib/constants";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function ReferralPanel() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/referral", { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled && res.ok) {
        setReferralCode(data.referralCode);
        setReferredCount(data.referredCount);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!referralCode) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="mb-3 h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/?ref=${referralCode}`;

  async function copy(value: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Your referral link</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Anyone who signs up through this link is registered under you. Every deposit they make earns you{" "}
          {Math.round(ADMIN_COMMISSION_SHARE * 100)}% commission, and you can track all their activity here.
        </p>

        <div className="mb-2 flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-sm text-foreground">
            {link}
          </div>
          <Button onClick={() => copy(link, "link")} className="gap-1.5">
            {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy link
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">Or share your code:</span>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-foreground">
              {referralCode}
            </span>
            <Button variant="outline" size="sm" onClick={() => copy(referralCode, "code")} className="gap-1.5">
              {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy code
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Users className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-extrabold tabular-nums text-foreground">{referredCount}</p>
          <p className="text-xs text-muted-foreground">players signed up with your link</p>
        </div>
      </div>
    </div>
  );
}
