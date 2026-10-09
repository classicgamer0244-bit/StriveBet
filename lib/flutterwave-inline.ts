/**
 * Browser-side Flutterwave Inline loader.
 *
 * The public key arrives inside the checkout config returned by
 * /api/deposits/initialize, which reads it from FLUTTERWAVE_PUBLIC_KEY.
 * Nothing here reads an env var directly.
 *
 * Inline opens the payment modal over the current page. There is deliberately
 * no `redirect_url`: Flutterwave gives it precedence over `callback`, so
 * setting it would silently turn this into a redirect flow and the deposit page
 * would lose control of the outcome.
 */

const SCRIPT_SRC = "https://checkout.flutterwave.com/v3.js";

export interface FlutterwaveCallbackPayload {
  status: string;
  tx_ref: string;
  transaction_id?: number;
}

export interface InlineCheckoutConfig {
  publicKey: string;
  tx_ref: string;
  /** MAJOR units — already converted by the payments service. */
  amount: number;
  currency: string;
  paymentOptions: string;
  customer: { email: string; name?: string; phone_number?: string };
  customizations: { title?: string; description?: string };
  meta: Record<string, string | number>;
}

interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  customer: { email: string; name?: string; phone_number?: string };
  customizations?: { title?: string; description?: string };
  meta?: Record<string, string | number>;
  callback?: (payload: FlutterwaveCallbackPayload) => void;
  onclose?: (incomplete?: boolean) => void;
}

interface FlutterwaveModal {
  close: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: FlutterwaveConfig) => FlutterwaveModal;
  }
}

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Flutterwave can only load in the browser."));
  }
  if (window.FlutterwaveCheckout) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => {
        // Reset so a later attempt can retry rather than reusing a dead promise.
        loader = null;
        reject(new Error("Could not reach Flutterwave. Check your connection."));
      },
      { once: true }
    );

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return loader;
}

export interface OpenCheckoutHandlers {
  /** Fired when the customer completes payment. Not proof of payment — the
   *  server still verifies independently before crediting anything. */
  onPaid: (payload: FlutterwaveCallbackPayload) => void;
  /** Fired when the modal is dismissed without a completed payment. */
  onDismissed: () => void;
}

export async function openFlutterwaveCheckout(
  config: InlineCheckoutConfig,
  handlers: OpenCheckoutHandlers
): Promise<void> {
  await loadScript();

  const open = window.FlutterwaveCheckout;
  if (!open) throw new Error("Flutterwave checkout was not available.");

  // `onclose` also fires after a completed payment, so it must not report a
  // dismissal once `callback` has taken ownership of the outcome.
  let paid = false;

  const modal = open({
    public_key: config.publicKey,
    tx_ref: config.tx_ref,
    amount: config.amount,
    currency: config.currency,
    payment_options: config.paymentOptions,
    customer: config.customer,
    customizations: config.customizations,
    meta: config.meta,
    callback: (payload) => {
      paid = true;
      modal.close();
      handlers.onPaid(payload);
    },
    onclose: () => {
      if (paid) return;
      handlers.onDismissed();
    },
  });
}
