function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  return key;
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export interface FictionalMatchup {
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
}

/**
 * Generates a realistic-sounding but entirely fictional matchup for admin
 * match creation — raw fetch against Groq's OpenAI-compatible chat
 * completions endpoint (no SDK, same convention as lib/payments-service.ts and
 * lib/arkesel.ts). Only fills team/league names — markets/odds stay on the
 * existing deterministic RNG generator and are never touched here.
 */
export async function generateFictionalMatchup(): Promise<FictionalMatchup> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            'You invent realistic-sounding but entirely fictional football club and league names for a demo sports betting platform. Never use real team, league, or competition names. Respond with strict JSON only, no markdown, no commentary, matching exactly: {"homeTeamName": string, "awayTeamName": string, "leagueName": string}. Team names should sound like real club names (a city or area name plus a nickname, e.g. "Rivertown United"). The league name should sound like a real domestic league or cup.',
        },
        { role: "user", content: "Generate one fictional matchup." },
      ],
      temperature: 1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed with status ${res.status}`);
  }

  const data: unknown = await res.json();
  const content = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).homeTeamName !== "string" ||
    typeof (parsed as Record<string, unknown>).awayTeamName !== "string" ||
    typeof (parsed as Record<string, unknown>).leagueName !== "string"
  ) {
    throw new Error("Groq returned an unexpected shape.");
  }

  const result = parsed as FictionalMatchup;
  return {
    homeTeamName: result.homeTeamName.trim(),
    awayTeamName: result.awayTeamName.trim(),
    leagueName: result.leagueName.trim(),
  };
}
