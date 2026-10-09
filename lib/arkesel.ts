const BASE_URL = "https://sms.arkesel.com/api";

function requireApiKey(): string {
  const key = process.env.ARKESEL_API_KEY;
  if (!key) throw new Error("ARKESEL_API_KEY is not configured.");
  return key;
}

/** Converts a local Ghanaian number ("0245123456") plus its country code
 * ("+233") into the international-digits-only format Arkesel expects
 * ("233245123456"). */
export function toArkeselNumber(localPhone: string, countryCode: string): string {
  const digits = localPhone.replace(/\D/g, "");
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode.replace(/\D/g, "")}${local}`;
}

export async function sendSms(internationalPhone: string, message: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/v2/sms/send`, {
    method: "POST",
    headers: { "api-key": requireApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: process.env.ARKESEL_SENDER_ID ?? "StiveBet",
      message,
      recipients: [internationalPhone],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Arkesel send failed (${res.status}): ${body}`);
  }
}
