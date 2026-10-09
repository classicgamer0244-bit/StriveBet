"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { openFlutterwaveCheckout, type InlineCheckoutConfig } from "@/lib/flutterwave-inline";

const STATUS_POLL_INTERVAL_MS = 3_000;
const STATUS_POLL_TIMEOUT_MS = 2 * 60_000;

type DepositTab = "mobile-money" | "card";
type NetworkCode = "MTN" | "VODAFONE" | "TIGO";

/** `code` is Flutterwave v3's wire value and is LEGACY BRANDING — Telecel is
 *  still "VODAFONE" upstream and AirtelTigo is still "TIGO". `label` is what the
 *  player sees. Sending the current brand names is rejected outright, so the two
 *  are deliberately kept apart. */
const NETWORKS: { code: NetworkCode; label: string; img: string }[] = [
  { code: "MTN", label: "MTN", img: "/mtn-momo.png" },
  { code: "VODAFONE", label: "Telecel", img: "/teleccash.png" },
  { code: "TIGO", label: "AirtelTigo", img: "/atmomo.jpg" },
];

const QUICK_AMOUNTS = [400, 500, 1000, 2000, 5000, 10000];

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function DepositForm() {
  const { player, refreshBalance } = useAuth();
  const [tab, setTab] = useState<DepositTab>("mobile-money");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState<NetworkCode>("MTN");
  // Derived rather than synced from `player` in an effect: the account phone is
  // the default, and the moment the player edits the field their value wins —
  // including clearing it. Syncing this into state would cascade a render every
  // time auth refreshes, and would fight the user if they deliberately blanked it.
  const [momoPhoneEdited, setMomoPhoneEdited] = useState<string | null>(null);
  const [voucher, setVoucher] = useState("");
  /** Set when the gateway asked for a texted code against an already-accepted
   *  charge. Holds the reference, because the retry MUST reuse it. */
  const [otpFor, setOtpFor] = useState<{ reference: string; instruction: string | null } | null>(null);
  const [otp, setOtp] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [minDeposit, setMinDeposit] = useState<number | null>(null);
  const [depositsEnabled, setDepositsEnabled] = useState<boolean>(true);
  const [waiting, setWaiting] = useState<{ reference: string; timedOut: boolean; kind: "modal" | "prompt" } | null>(
    null
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await readJson(res);
      if (cancelled) return;
      if (typeof data?.minDepositAmount === "number") setMinDeposit(data.minDepositAmount);
      if (typeof data?.depositsEnabled === "boolean") setDepositsEnabled(data.depositsEnabled);
    })();
    return () => { cancelled = true; };
  }, []);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  }

  useEffect(() => stopPolling, []);

  // Ghana MoMo's authorization mode is `redirect`, so completing a payment takes
  // the player off this page entirely and the poll started before they left is
  // gone. Crediting never depended on that poll (the webhook and the sweep both
  // run server-side), but without this the player comes back to a blank form
  // and reasonably assumes the deposit failed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const respRaw = params.get("resp");
    if (!params.has("ref") && !respRaw) return;

    // Cleared FIRST and unconditionally, before any parsing that could throw.
    // Flutterwave's `resp` payload is multi-kilobyte JSON; left in the address
    // bar it persists through history, gets re-processed on every reload, and
    // makes the URL long enough to upset the dev server.
    window.history.replaceState({}, "", "/account/deposit");

    // `ref` is ours, `resp` is Flutterwave's — the MoMo return leg rewrites the
    // query string, so ours does not always survive and `resp.data.txRef` is
    // the reliable source.
    let reference = params.get("ref");
    if (!reference && respRaw) {
      try {
        reference = (JSON.parse(respRaw) as { data?: { txRef?: string } })?.data?.txRef ?? null;
      } catch {
        /* Malformed payload — nothing to resume from. The webhook and the
           pending-deposit sweep still credit this server-side regardless. */
      }
    }

    // Only the reference is taken from it. `resp` arrives via the address bar
    // and is trivially forgeable, so its "status":"successful" is ignored
    // entirely — the poll re-asks our server, which verifies with Flutterwave
    // using the secret key. Same verify-don't-trust rule as the Inline callback.
    if (reference) startPolling(reference, "prompt");
    // Runs once on mount; startPolling is stable for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling(reference: string, kind: "modal" | "prompt") {
    setWaiting({ reference, timedOut: false, kind });
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/deposits/status?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await readJson(res);
      if (!res.ok || !data?.status) return;
      if (data.status === "SUCCESS") {
        stopPolling();
        setWaiting(null);
        toast.success("Deposit successful — your balance has been updated.");
        refreshBalance();
      } else if (data.status === "FAILED") {
        stopPolling();
        setWaiting(null);
        toast.error("That deposit didn't go through. You can try again.");
      }
    }, STATUS_POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setWaiting((w) => (w ? { ...w, timedOut: true } : w));
    }, STATUS_POLL_TIMEOUT_MS);
  }

  const momoPhone = momoPhoneEdited ?? player?.phone ?? "";
  const amountNum = Number(amount) || 0;
  const isValidAmount = minDeposit !== null && amountNum >= minDeposit;
  // Telecel has no handset prompt: the customer generates a one-time voucher on
  // their phone and types it in, so the form cannot be submitted without it.
  const momoReady =
    tab !== "mobile-money" ||
    (momoPhone.replace(/\D/g, "").length >= 9 && (network !== "VODAFONE" || voucher.trim().length > 0));
  const canSubmit = isValidAmount && momoReady && !isBusy && !waiting && depositsEnabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (minDeposit !== null && amountValue < minDeposit) {
      toast.error(`Minimum deposit is ${CURRENCY} ${minDeposit.toFixed(2)}.`);
      return;
    }

    setIsBusy(true);
    try {
      const res = await fetch("/api/deposits/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          channel: tab === "card" ? "card" : "mobile_money",
          ...(tab === "mobile-money"
            ? { network, phone: momoPhone.replace(/\D/g, ""), ...(network === "VODAFONE" ? { voucher: voucher.trim() } : {}) }
            : {}),
        }),
      });
      const data = await readJson(res);
      if (!res.ok || !data?.reference) {
        toast.error(data?.error ?? "Couldn't start the deposit. Please try again.");
        return;
      }

      // Branch on the response SHAPE, not on a client-side flag — the server
      // decides whether this deposit is a server-side charge or the Inline
      // modal, so the two can never disagree about which flow is running.
      // Logged deliberately, and left in. A browser extension injecting into
      // the checkout origin can bury a real failure under hundreds of frames
      // of its own; one tagged line makes ours findable with a filter.
      console.info("[deposit] server said:", {
        mode: data.mode,
        action: data.action,
        redirectUrl: data.redirectUrl ?? null,
        hasCheckout: Boolean(data.checkout),
      });

      if (data.mode === "momo_direct") {
        // The gateway texted a code and wants it back against this SAME
        // reference. Polling deliberately does NOT start yet: the charge has
        // not been authorised, so there is nothing to wait for, and showing the
        // "confirming…" screen would hide the field we need them to fill in.
        if (data.action === "otp_required") {
          setOtpFor({ reference: data.reference, instruction: data.instruction ?? null });
          return;
        }
        // Started before any navigation, for the same reason as below.
        startPolling(data.reference, "prompt");
        if (data.action === "redirect" && data.redirectUrl) {
          console.info("[deposit] navigating to gateway:", data.redirectUrl);
          window.location.href = data.redirectUrl as string;
          return;
        }
        // Reached only when the server said "redirect" but gave no URL, or
        // sent an action this build does not know. Silence here is how a
        // player ends up staring at a screen that will never change.
        if (data.action !== "await_approval") {
          console.error("[deposit] unusable action from server:", data.action, data);
          toast.error("Couldn't open the payment page. Please try again.");
        }
        return;
      }

      if (!data.checkout) {
        toast.error("Couldn't start the deposit. Please try again.");
        return;
      }
      const checkout = data.checkout as InlineCheckoutConfig;

      // Polling starts BEFORE the modal opens. The server credits independently
      // of this poll (forwarded webhook + backstop sweep), so a customer who
      // pays and immediately closes the page still gets credited — the poll is
      // only how this screen finds out.
      startPolling(data.reference, "modal");

      await openFlutterwaveCheckout(checkout, {
        onPaid: () => {
          // Deliberately does NOT credit anything or trust this callback. The
          // balance moves only once the server has verified with Flutterwave.
          toast.info("Payment received — confirming your deposit…");
        },
        onDismissed: () => {
          stopPolling();
          setWaiting(null);
          toast.message("Deposit cancelled. Nothing was charged.");
        },
      });
    } catch (err) {
      stopPolling();
      setWaiting(null);
      toast.error(err instanceof Error ? err.message : "Couldn't reach the payment service. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpFor || isBusy) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/deposits/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The reference is carried, never re-minted — the gateway is waiting on
        // this exact one, and a new deposit would be a second charge.
        body: JSON.stringify({ reference: otpFor.reference, otp: otp.trim() }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        // A rejected code leaves the deposit open so they can try again — only
        // the server closes it, and only when the gateway actually declines.
        toast.error(data?.error ?? "That code wasn't accepted. Please try again.");
        return;
      }
      setOtpFor(null);
      setOtp("");
      startPolling(otpFor.reference, "prompt");
      if (data.action === "redirect" && data.redirectUrl) window.location.href = data.redirectUrl as string;
    } catch {
      toast.error("Couldn't verify that code. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  if (otpFor) {
    return (
      <form
        onSubmit={submitOtp}
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center"
      >
        <p className="text-sm font-bold text-foreground">Enter the code we texted you</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {otpFor.instruction ?? `We sent a verification code by SMS to ${momoPhone}.`}
        </p>
        <Input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          className="max-w-[220px] text-center tracking-widest"
        />
        <Button type="submit" disabled={otp.trim().length === 0 || isBusy} className="mt-1 h-11 w-full max-w-[220px]">
          {isBusy ? "Verifying…" : "Confirm"}
        </Button>
        {/* The approval prompt reaches the handset WHILE this request is still
            in flight, so a bare spinner tells the player to wait when they
            should be looking at their phone. Said here rather than only on the
            next screen, because by then they have already missed it. */}
        {isBusy ? (
          <p className="max-w-xs text-xs text-muted-foreground">
            A payment prompt may appear on your phone at any moment — approve it with your PIN.
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => {
            // Abandons the SCREEN, not the charge: the deposit stays PENDING and
            // still settles if they complete it on their handset, and the sweep
            // resolves it either way. Closing it here would be a lie.
            setOtpFor(null);
            setOtp("");
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  if (waiting) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
        {!waiting.timedOut ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            {/* The heading has to match what the player is actually being asked
                to do. "Confirming…" while the PIN prompt is still sitting on
                their handset reads as "we're done, sit tight" and they stop
                looking at their phone — which is the one thing that stalls the
                payment. */}
            <p className="text-sm font-bold text-foreground">
              {waiting.kind === "prompt" ? "Approve on your phone" : "Confirming your deposit…"}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {waiting.kind === "prompt" ? (
                <>
                  Check your phone for the Mobile Money approval prompt and enter your PIN. If you don&apos;t see it,
                  dial <span className="font-semibold text-foreground">*170#</span> and approve from your pending
                  approvals.
                </>
              ) : (
                <>Complete the payment in the window that opened. Your balance updates automatically once it&apos;s confirmed.</>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-foreground">Still pending</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              This is taking longer than expected. We&apos;ll update your balance automatically once it&apos;s confirmed.
            </p>
          </>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => {
            stopPolling();
            setWaiting(null);
          }}
        >
          {waiting.timedOut ? "Start a new deposit" : "Cancel"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!depositsEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-500" />
          <div>
            <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Deposits on hold</p>
            <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
              We&apos;re currently experiencing some issues with deposits. We&apos;re working on it and it will be restored shortly. Sorry for the inconvenience.
            </p>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card">
      <Tabs value={tab} onValueChange={(v) => setTab(v as DepositTab)}>
        <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border px-4 pt-1">
          <TabsTrigger value="mobile-money" className="py-2.5 text-sm font-semibold">
            Mobile Money
          </TabsTrigger>
          <TabsTrigger value="card" className="py-2.5 text-sm font-semibold">
            Card
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit} className="p-4">
          <TabsContent value="mobile-money" className="mt-0 flex flex-col gap-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Choose network</p>
            <div className="grid grid-cols-3 gap-2">
              {NETWORKS.map((n) => (
                <button
                  key={n.code}
                  type="button"
                  onClick={() => setNetwork(n.code)}
                  aria-pressed={network === n.code}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border bg-background py-3 transition-colors",
                    network === n.code
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <img src={n.img} alt={n.label} style={{ width: 40, height: 40, objectFit: "fill" }} />
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      network === n.code ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {n.label}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <Label className="mb-1.5">Mobile Money number</Label>
              <Input
                value={momoPhone}
                onChange={(e) => setMomoPhoneEdited(e.target.value)}
                placeholder="024 000 0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            {/* Telecel is the one network with no handset prompt: the customer
                generates a one-time voucher themselves and types it in here. */}
            {network === "VODAFONE" && (
              <div>
                <Label className="mb-1.5">Telecel voucher</Label>
                <Input
                  value={voucher}
                  onChange={(e) => setVoucher(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={20}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Dial <span className="font-semibold text-foreground">*110#</span> on your Telecel phone, choose
                  option 6, enter your PIN, then type the voucher here. It expires quickly, so generate it just
                  before paying.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {network === "VODAFONE"
                ? "We'll charge this wallet using the voucher above."
                : "You'll get an approval prompt on this number — enter your PIN to confirm."}
            </p>
          </TabsContent>

          <TabsContent value="card" className="mt-0 flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <CreditCard className="size-8 text-primary" />
              <div>
                <p className="text-sm font-extrabold text-foreground">Debit or credit card</p>
                <p className="text-xs text-muted-foreground">Visa · Mastercard · Verve</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Your card details are entered on the secure payment window and never touch StriveBet.
            </p>
          </TabsContent>

          {/* Amount — shared by both tabs now that card is live. */}
          <div className="mt-4">
            <Label className="mb-1.5">Amount ({CURRENCY})</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={minDeposit !== null ? `min. ${(minDeposit + 16).toLocaleString("en-GH")}` : "…"}
              inputMode="decimal"
            />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={cn(
                    "rounded border py-1.5 text-xs font-semibold transition-colors",
                    amountNum === q
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  )}
                >
                  +{q.toLocaleString("en-GH")}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={!canSubmit} className="mt-4 h-11 w-full text-base">
              {isBusy ? "Opening secure payment…" : depositsEnabled ? "Top Up Now" : "Deposits unavailable"}
            </Button>

          </div>
        </form>
      </Tabs>

      <div className="border-t border-border p-4">
        <h3 className="mb-2 text-sm font-bold text-foreground">Note</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-muted-foreground">
          <li>Minimum per transaction is {CURRENCY} {minDeposit !== null ? (minDeposit + 16).toLocaleString("en-GH") : "…"}</li>
          <li>Deposit is free, no transaction fees.</li>
          <li>Your balance updates automatically once the payment is confirmed.</li>
        </ol>
      </div>
      </div>
    </div>
  );
}
