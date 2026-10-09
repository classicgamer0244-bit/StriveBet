/**
 * Payments via Flutterwave — direct server-side integration.
 *
 * StriveBet now holds its own Flutterwave credentials. All charges, status
 * checks, and webhook verification happen here, with no intermediary service.
 *
 * ## Env vars required
 *   FLUTTERWAVE_SECRET_KEY   — your Flutterwave secret key (sk_…)
 *   FLUTTERWAVE_PUBLIC_KEY   — your Flutterwave public key (FLWPUBK…)
 *   FLUTTERWAVE_WEBHOOK_HASH — the webhook secret hash set in the FLW dashboard
 *
 * ## The id model
 *
 * Flutterwave accepts an arbitrary `tx_ref`, so our own `dep_…` reference IS
 * the gateway reference — no second id to mint and join on.
 * `gatewayTransactionId` holds Flutterwave's numeric transaction id once a
 * charge completes, purely for support lookups.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const FLW_BASE = "https://api.flutterwave.com/v3";
const REQUEST_TIMEOUT_MS = 20_000;

/** Which gateway NEW mobile-money charges go to. Flutterwave unless explicitly
 * switched, so a missing/typo'd value can never silently reroute deposits.
 * In-flight deposits are NOT affected by this: status checks and OTP retries
 * follow the gateway recorded on the transaction (see isShinobiRef). */
function activeGateway(): "flutterwave" | "shinobipay" {
  return process.env.PAYMENT_GATEWAY?.trim().toLowerCase() === "shinobipay" ? "shinobipay" : "flutterwave";
}

/** ShinobiPay ids are `pi_…`; Flutterwave's are numeric, so the stored
 * gatewayTransactionId alone says which gateway owns a transaction. */
const isShinobiRef = (ref?: string | null): boolean => Boolean(ref && ref.startsWith("pi_"));

export class PaymentsServiceError extends Error {
  body: unknown = null;
}

/** A misconfiguration — missing env vars. Retrying cannot help. */
export class PaymentsServiceConfigError extends PaymentsServiceError {}

function requireConfig(): { secretKey: string; publicKey: string } {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  if (!secretKey) throw new PaymentsServiceConfigError("FLUTTERWAVE_SECRET_KEY is not configured.");
  if (!publicKey) throw new PaymentsServiceConfigError("FLUTTERWAVE_PUBLIC_KEY is not configured.");
  return { secretKey, publicKey };
}

/** Maps Flutterwave's status vocabulary onto ours. Unknown statuses stay
 * PENDING — an unknown status must never be read as either "credit" or "fail".
 * MISMATCH maps to PENDING: the customer was debited but a check disagreed —
 * left open for manual resolution rather than silently losing their money. */
export function toTransactionStatus(status: string): "PENDING" | "SUCCESS" | "FAILED" {
  const s = status.trim().toUpperCase();
  if (s === "SUCCESS" || s === "SUCCESSFUL" || s === "SUCCEEDED" || s === "COMPLETED") return "SUCCESS";
  if (s === "FAILED" || s === "CANCELLED" || s === "CANCELED" || s === "DECLINED" || s === "ERROR") return "FAILED";
  return "PENDING";
}

export const isMismatch = (status: string): boolean =>
  status.trim().toUpperCase() === "MISMATCH";

async function flwFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { secretKey } = requireConfig();

  let res: Response;
  try {
    res = await fetch(`${FLW_BASE}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new PaymentsServiceError(`Flutterwave request failed (network) for ${path}: ${detail}`);
  }

  const text = await res.text();

  if (!res.ok) {
    let detail = text.slice(0, 200);
    let parsedBody: unknown = null;
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      parsedBody = parsed;
      if (parsed?.message) detail = String(parsed.message);
    } catch { /* Not JSON */ }

    const failure = new PaymentsServiceError(
      `Flutterwave ${path} failed (HTTP ${res.status}): ${detail}`
    );
    failure.body = parsedBody;
    throw failure;
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new PaymentsServiceError(
      `Flutterwave returned non-JSON for ${path} (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Inline checkout (card + browser-side MoMo modal)
// ---------------------------------------------------------------------------

/** What the browser needs to open the Flutterwave Inline modal. */
export interface CheckoutConfig {
  publicKey: string;
  tx_ref: string;
  /** MAJOR units. */
  amount: number;
  currency: string;
  paymentOptions: string;
  customer: { email: string; name?: string; phone_number?: string };
  customizations: { title?: string; description?: string };
  meta: Record<string, string | number>;
}

export interface InitiateInput {
  reference: string;
  amountMinor: number;
  customer: { email: string; name?: string; phone?: string };
  channel?: "mobile_money" | "card" | "any";
  metadata?: Record<string, string | number>;
}

/**
 * Builds the checkout config the browser needs to open the Flutterwave modal.
 * No network call — the public key comes straight from env.
 */
export function createCheckout(input: InitiateInput): CheckoutConfig {
  const { publicKey } = requireConfig();
  const amountMajor = input.amountMinor / 100;

  const paymentOptions =
    input.channel === "card"
      ? "card"
      : input.channel === "mobile_money"
      ? "mobilemoneyghana"
      : "card,mobilemoneyghana";

  return {
    publicKey,
    tx_ref: input.reference,
    amount: amountMajor,
    currency: "GHS",
    paymentOptions,
    customer: {
      email: input.customer.email,
      name: input.customer.name,
      phone_number: input.customer.phone,
    },
    customizations: { title: "StriveBet", description: `Deposit ${input.reference}` },
    meta: { ...input.metadata },
  };
}

// ---------------------------------------------------------------------------
// Server-side Ghana MoMo charge
// ---------------------------------------------------------------------------

/** v3 Ghana wire values — legacy branding, not current brand names. */
export type MomoNetworkCode = "MTN" | "VODAFONE" | "TIGO";

export interface MomoChargeInput {
  reference: string;
  amountMinor: number;
  network: MomoNetworkCode;
  phone: string;
  otp?: string;
  voucher?: string;
  providerRef?: string | null;
  customer: { email: string; name?: string };
  metadata?: Record<string, string | number>;
  clientIp?: string;
  redirectUrl?: string;
}

export interface MomoChargeResult {
  ok: boolean;
  action?: "redirect" | "await_approval" | "otp_required";
  redirectUrl?: string | null;
  instruction?: string | null;
  provider?: string;
  providerRef?: string | null;
  error?: string;
  gateway?: unknown;
}

/**
 * Starts a Ghana Mobile Money charge server-side via Flutterwave v3.
 *
 * `ok: true` means the charge was accepted for authorisation — never that
 * money moved. Only checkPaymentStatus() may decide that.
 */
export async function createMomoCharge(input: MomoChargeInput): Promise<MomoChargeResult> {
  // An OTP retry carries the id the charge was created under — follow that
  // gateway, not the current setting, or it would open a second charge elsewhere.
  const useShinobi = input.providerRef ? isShinobiRef(input.providerRef) : activeGateway() === "shinobipay";
  return useShinobi ? createShinobiMomoCharge(input) : createFlutterwaveMomoCharge(input);
}

async function createFlutterwaveMomoCharge(input: MomoChargeInput): Promise<MomoChargeResult> {
  const amountMajor = input.amountMinor / 100;

  const body: Record<string, unknown> = {
    tx_ref: input.reference,
    amount: amountMajor,
    currency: "GHS",
    network: input.network,
    email: input.customer.email,
    fullname: input.customer.name,
    phone_number: input.phone,
    ...(input.otp ? { otp: input.otp } : {}),
    ...(input.voucher ? { voucher: input.voucher } : {}),
    ...(input.clientIp ? { client_ip: input.clientIp } : {}),
    ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
    meta: input.metadata ?? {},
  };

  // OTP retry: re-authorize the existing charge rather than starting a new one.
  if (input.providerRef) body.flw_ref = input.providerRef;

  let raw: unknown;
  try {
    raw = await flwFetch<unknown>("/charges?type=mobile_money_ghana", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw err;
  }

  const resp = raw as {
    status?: string;
    message?: string;
    data?: {
      id?: number;
      flw_ref?: string;
      status?: string;
      auth_mode?: string;
      redirect?: string;
      processor_response?: string;
    };
    meta?: { authorization?: { redirect?: string; mode?: string; validate_instructions?: string } };
  };

  const authMode = resp.meta?.authorization?.mode ?? resp.data?.auth_mode;
  const redirectUrl = resp.meta?.authorization?.redirect ?? resp.data?.redirect ?? null;

  // The captcha-verification flow (auth_mode "redirect") replies with just
  // `{ status: "success", meta: { authorization: { mode: "redirect", ... } } }`
  // — no `data` object at all, so no `data.status` to check. Treat a valid
  // redirect authorization as OK on its own; every other path still requires
  // the usual data.status PENDING/SUCCESS.
  const dataStatus = resp.data?.status?.toUpperCase();
  const hasRedirectAuth = authMode === "redirect" && Boolean(redirectUrl);
  const isOk =
    resp.status === "success" && (dataStatus === "PENDING" || dataStatus === "SUCCESS" || hasRedirectAuth);

  if (!isOk) {
    return {
      ok: false,
      error: resp.message ?? resp.data?.processor_response ?? "The network declined the payment.",
      gateway: raw,
    };
  }

  let action: MomoChargeResult["action"] = "await_approval";
  if (authMode === "redirect" && redirectUrl) action = "redirect";
  else if (authMode === "otp" || authMode === "validate") action = "otp_required";

  return {
    ok: true,
    action,
    redirectUrl: redirectUrl ?? null,
    instruction: resp.meta?.authorization?.validate_instructions ?? null,
    provider: "flutterwave",
    providerRef: resp.data?.flw_ref ? String(resp.data.flw_ref) : null,
    gateway: raw,
  };
}

// ---------------------------------------------------------------------------
// Payment status verification
// ---------------------------------------------------------------------------

export interface PaymentStatusResult {
  status: string;
  transactionId: number | null;
  amountMajor: number | null;
  raw: unknown;
}

/**
 * Server-to-server confirmation of a deposit's outcome.
 *
 * This is the ONLY thing allowed to decide that money arrived. The webhook is
 * treated purely as a hint to come and ask — verify, don't trust.
 */
export async function checkPaymentStatus(
  reference: string,
  amountMinor: number,
  gateway: { provider?: string | null; providerRef?: string | null } = {}
): Promise<PaymentStatusResult> {
  if (gateway.provider === "shinobipay") return checkShinobiStatus(reference, amountMinor, gateway.providerRef);

  const raw = await flwFetch<{
    status?: string;
    data?: Array<{
      id?: number;
      status?: string;
      amount?: number;
      currency?: string;
      tx_ref?: string;
    }>;
  }>(`/transactions?tx_ref=${encodeURIComponent(reference)}`, { method: "GET" });

  const txn = raw.data?.[0];

  if (!txn) {
    // No record at Flutterwave yet — still pending.
    return { status: "PENDING", transactionId: null, amountMajor: null, raw };
  }

  const flwStatus = txn.status ?? "pending";
  const mapped = toTransactionStatus(flwStatus);

  // Amount mismatch check — the gateway confirmed a charge but for a different
  // amount. Left as MISMATCH so a human can investigate rather than silently
  // crediting the wrong figure.
  if (mapped === "SUCCESS" && typeof txn.amount === "number") {
    const expectedMajor = amountMinor / 100;
    if (Math.abs(txn.amount - expectedMajor) > 0.01) {
      return { status: "MISMATCH", transactionId: txn.id ?? null, amountMajor: txn.amount, raw };
    }
  }

  return {
    status: mapped === "SUCCESS" ? "SUCCESS" : mapped === "FAILED" ? "FAILED" : flwStatus,
    transactionId: txn.id ?? null,
    amountMajor: typeof txn.amount === "number" ? txn.amount : null,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the `verif-hash` header Flutterwave sends with every webhook.
 * Returns true only when the header matches FLUTTERWAVE_WEBHOOK_HASH exactly.
 */
export function verifyWebhookSignature(providedHash: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected || !providedHash) return false;
  // Constant-time comparison to prevent timing attacks.
  const a = Buffer.from(providedHash);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Helpers — kept for call-site compatibility
// ---------------------------------------------------------------------------

export function gatewayRefFrom(txn: {
  gatewayTransactionId?: string | null;
  gatewayRaw?: unknown;
}): { provider?: string; providerRef?: string } {
  return {
    provider: isShinobiRef(txn.gatewayTransactionId) ? "shinobipay" : "flutterwave",
    ...(txn.gatewayTransactionId ? { providerRef: txn.gatewayTransactionId } : {}),
  };
}

// ---------------------------------------------------------------------------
// ShinobiPay (Ghana mobile money)
// ---------------------------------------------------------------------------
//
// Env: SHINOBIPAY_SECRET_KEY (sk_live_…), SHINOBIPAY_WEBHOOK_SECRET (whsec_…),
// optional SHINOBIPAY_BASE_URL. The documented host api.shinobipay.com does not
// resolve; the API is currently served from shinobipay.vercel.app/api/v1 — set
// SHINOBIPAY_BASE_URL (no code change) once their own domain is live.
//
// As with Flutterwave, a charge being accepted never means money moved. Only
// checkShinobiStatus() — a server-to-server lookup by intent id — may decide that.

const SHINOBI_DEFAULT_BASE = "https://shinobipay.vercel.app/api/v1";

interface ShinobiResponse {
  status: number;
  body: Record<string, unknown> & { error?: { code?: string; message?: string } };
}

async function shinobiRequest(path: string, init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string }): Promise<ShinobiResponse> {
  const secretKey = process.env.SHINOBIPAY_SECRET_KEY;
  if (!secretKey) throw new PaymentsServiceConfigError("SHINOBIPAY_SECRET_KEY is not configured.");
  const base = (process.env.SHINOBIPAY_BASE_URL?.trim() || SHINOBI_DEFAULT_BASE).replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: init.method,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new PaymentsServiceError(`ShinobiPay request failed (network) for ${path}: ${detail}`);
  }

  const text = await res.text();
  let body: ShinobiResponse["body"];
  try {
    body = (text ? JSON.parse(text) : {}) as ShinobiResponse["body"];
  } catch {
    throw new PaymentsServiceError(`ShinobiPay returned non-JSON for ${path} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, body };
}

/** Auth, rate-limit and server faults are OURS or theirs to fix, not the
 * customer's — surface them as thrown errors so the caller treats the gateway
 * as unreachable rather than telling the customer their payment was declined. */
function throwUnlessClientError(path: string, r: ShinobiResponse): void {
  if (r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) {
    throw new PaymentsServiceError(
      `ShinobiPay ${path} failed (HTTP ${r.status}): ${r.body.error?.code ?? "?"} ${r.body.error?.message ?? ""}`.trim()
    );
  }
}

/** ShinobiPay takes local (0244…) or international (233244…) numbers. Players
 * often type 9 digits without the leading 0, so normalise to local form. */
function toGhLocalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

const SHINOBI_NETWORKS: Record<MomoNetworkCode, string> = { MTN: "MTN", VODAFONE: "TELECEL", TIGO: "AIRTELTIGO" };

/** Strips the intent's client_secret/checkout_url before it is logged or stored:
 * the secret authorises public checkout calls on that intent and has no reason
 * to sit in our database or logs. */
function redactShinobi(body: ShinobiResponse["body"]): Record<string, unknown> {
  const { client_secret: _cs, checkout_url: _url, ...rest } = body as Record<string, unknown>;
  return rest;
}

function toShinobiResult(r: ShinobiResponse): MomoChargeResult {
  const intent = r.body as {
    id?: string;
    status?: string;
    next_action?: { type?: string; url?: string; ussd_fallback?: string };
  };

  if (r.status >= 400 || intent.status === "failed") {
    return {
      ok: false,
      error: r.body.error?.message ?? "The network declined the payment.",
      gateway: redactShinobi(r.body),
    };
  }

  const next = intent.next_action;
  let action: MomoChargeResult["action"] = "await_approval";
  if (next?.type === "redirect" && next.url) action = "redirect";
  else if (next?.type === "submit_otp") action = "otp_required";

  return {
    ok: true,
    action,
    redirectUrl: action === "redirect" ? next?.url ?? null : null,
    instruction: action === "await_approval" && next?.ussd_fallback
      ? `No prompt? Dial ${next.ussd_fallback} to approve the payment.`
      : null,
    provider: "shinobipay",
    providerRef: intent.id ?? null,
    gateway: redactShinobi(r.body),
  };
}

async function createShinobiMomoCharge(input: MomoChargeInput): Promise<MomoChargeResult> {
  // OTP retry: validate the existing intent instead of creating a second one.
  if (input.otp && isShinobiRef(input.providerRef)) {
    const path = `/payment_intents/${encodeURIComponent(input.providerRef!)}/validate`;
    const r = await shinobiRequest(path, {
      method: "POST",
      body: { otp: input.otp },
      idempotencyKey: `${input.reference}-otp-${input.otp}`,
    });
    throwUnlessClientError(path, r);
    return toShinobiResult(r);
  }

  const r = await shinobiRequest("/payment_intents", {
    method: "POST",
    // Our own dep_ reference is unique per attempt, so reusing it as the
    // idempotency key makes a network-level retry of THIS request safe (the
    // stored response comes back instead of a second charge).
    idempotencyKey: input.reference,
    body: {
      amount: Math.round(input.amountMinor),
      currency: "GHS",
      method: "mobile_money",
      network: SHINOBI_NETWORKS[input.network],
      customer: {
        phone: toGhLocalPhone(input.phone),
        email: input.customer.email,
        ...(input.customer.name ? { name: input.customer.name } : {}),
      },
      reference: input.reference,
      description: "StriveBet deposit",
      ...(input.redirectUrl ? { return_url: input.redirectUrl } : {}),
      metadata: Object.fromEntries(Object.entries(input.metadata ?? {}).map(([k, v]) => [k, String(v)])),
    },
  });
  throwUnlessClientError("/payment_intents", r);
  return toShinobiResult(r);
}

async function checkShinobiStatus(
  reference: string,
  amountMinor: number,
  providerRef?: string | null
): Promise<PaymentStatusResult> {
  // Without the intent id there is nothing to look up — stay pending rather
  // than guess. (initialize persists it the moment the charge is created.)
  if (!providerRef || !isShinobiRef(providerRef)) {
    return { status: "PENDING", transactionId: null, amountMajor: null, raw: { note: "no ShinobiPay intent id on record" } };
  }

  const path = `/payment_intents/${encodeURIComponent(providerRef)}`;
  const r = await shinobiRequest(path, { method: "GET" });
  if (r.status < 200 || r.status >= 300) {
    throw new PaymentsServiceError(
      `ShinobiPay ${path} failed (HTTP ${r.status}): ${r.body.error?.code ?? "?"} ${r.body.error?.message ?? ""}`.trim()
    );
  }

  const intent = r.body as { status?: string; amount?: number; currency?: string; reference?: string };
  const raw = redactShinobi(r.body);
  const state = String(intent.status ?? "").toLowerCase();

  // Only a confirmed success is checked against what we expected. Crediting is
  // the one irreversible step, so any disagreement parks the deposit as
  // MISMATCH for a human instead of crediting it.
  if (state === "succeeded") {
    const wrongAmount = typeof intent.amount !== "number" || intent.amount !== amountMinor;
    const wrongCurrency = intent.currency !== undefined && intent.currency !== "GHS";
    const wrongReference = intent.reference !== undefined && intent.reference !== reference;
    if (wrongAmount || wrongCurrency || wrongReference) {
      return {
        status: "MISMATCH",
        transactionId: null,
        amountMajor: typeof intent.amount === "number" ? intent.amount / 100 : null,
        raw,
      };
    }
    return { status: "SUCCESS", transactionId: null, amountMajor: intent.amount! / 100, raw };
  }

  // "failed" is terminal. Everything else — requires_action, processing, and
  // `unknown` (customer may or may not have been debited) — stays PENDING; the
  // gateway itself says never to treat unknown as failure.
  if (state === "failed") return { status: "FAILED", transactionId: null, amountMajor: null, raw };
  return { status: "PENDING", transactionId: null, amountMajor: null, raw };
}

/**
 * Verifies ShinobiPay's `X-AkwaPay-Signature: t=<unix>,v1=<hex>` header —
 * HMAC-SHA256 of `<t>.<raw body>` keyed with the endpoint's whsec_ secret. Must
 * be given the RAW request text: re-serialised JSON has different bytes and
 * would never match. Rejects anything older than 5 minutes (replay protection).
 */
export function verifyShinobiWebhook(rawBody: string, header: string | null): boolean {
  const secret = process.env.SHINOBIPAY_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const i = piece.indexOf("=");
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Always false now — there is only one gateway and it cannot be "retired". */
export function isRetiredProviderError(_err: unknown): boolean {
  return false;
}
