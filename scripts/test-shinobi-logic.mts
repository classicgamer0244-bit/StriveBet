// Offline checks of the ShinobiPay money-safety logic. No network, no keys.
import { createHmac } from "node:crypto";

process.env.SHINOBIPAY_WEBHOOK_SECRET = "whsec_test_secret";
const { verifyShinobiWebhook, gatewayRefFrom, toTransactionStatus } = await import("../lib/payments-service.ts");

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
};

const body = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { reference: "dep_abc" } });
const sign = (t: number, b: string, secret = "whsec_test_secret") =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${b}`).digest("hex")}`;
const now = Math.floor(Date.now() / 1000);

check("valid signature accepted", verifyShinobiWebhook(body, sign(now, body)));
check("tampered body rejected", !verifyShinobiWebhook(body.replace("dep_abc", "dep_xyz"), sign(now, body)));
check("wrong secret rejected", !verifyShinobiWebhook(body, sign(now, body, "whsec_other")));
check("old timestamp (replay) rejected", !verifyShinobiWebhook(body, sign(now - 600, body)));
check("future timestamp rejected", !verifyShinobiWebhook(body, sign(now + 600, body)));
check("missing header rejected", !verifyShinobiWebhook(body, null));
check("garbage header rejected", !verifyShinobiWebhook(body, "nonsense"));
check("short v1 rejected (no throw)", !verifyShinobiWebhook(body, `t=${now},v1=abc`));

check("pi_ id routes to shinobipay", gatewayRefFrom({ gatewayTransactionId: "pi_01HXYZ" }).provider === "shinobipay");
check("numeric id routes to flutterwave", gatewayRefFrom({ gatewayTransactionId: "123456" }).provider === "flutterwave");
check("no id defaults to flutterwave", gatewayRefFrom({ gatewayTransactionId: null }).provider === "flutterwave");

check("succeeded -> SUCCESS", toTransactionStatus("succeeded") === "SUCCESS");
check("failed -> FAILED", toTransactionStatus("failed") === "FAILED");
check("unknown stays PENDING", toTransactionStatus("unknown") === "PENDING");
check("processing stays PENDING", toTransactionStatus("processing") === "PENDING");
check("requires_action stays PENDING", toTransactionStatus("requires_action") === "PENDING");

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
