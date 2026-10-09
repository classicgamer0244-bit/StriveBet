This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# maxbet-betting-platform

---

## Deposits — how payments work

MaxBet integrates with Flutterwave directly. There is no intermediary service.

```
player → /api/deposits/initialize
           ├→ MoMo (server-side): POST /v3/charges?type=mobile_money_ghana
           └→ Card / fallback:    returns CheckoutConfig → Flutterwave Inline modal
Flutterwave → /api/webhooks/payments  (verif-hash)
                └→ checkPaymentStatus() via GET /v3/transactions?tx_ref=…
                   └→ creditSuccessfulDeposit()
```

### Env

```
FLUTTERWAVE_SECRET_KEY=sk_…
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK…
FLUTTERWAVE_WEBHOOK_HASH=<hash set in the Flutterwave dashboard>
```

Set the webhook URL in the Flutterwave dashboard to:
`https://your-domain.com/api/webhooks/payments`

### Rules this flow keeps

- **Verify, don't trust.** The webhook is only a hint to go and ask.
  Crediting is always decided by an independent `checkPaymentStatus()` call
  against `GET /v3/transactions?tx_ref=…`.
- **Idempotent.** `creditSuccessfulDeposit()` / `markFailedDeposit()` use the
  atomic PENDING-guarded `updateMany`, so the webhook, the status poll's
  self-heal, and the sweep can race safely — whichever lands first wins.
- **`reference` is the gateway reference.** Flutterwave accepts an arbitrary
  `tx_ref`, so the `dep_…` reference is sent as-is. `gatewayTransactionId`
  records Flutterwave's numeric id after the fact, for support lookups.
- **The sweep filters on the `dep_` prefix**, not on `gatewayTransactionId`.
  That field is empty until a charge completes, so filtering on it would skip
  every sweepable deposit.
