import { SignJWT, jwtVerify } from "jose";

/** Falls back to a dev-only value so a missing JWT_SECRET fails loudly in
 * production (every verify fails) rather than crashing the module at import time. */
function secretKey() {
  const secret = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me-32bytes-min";
  return new TextEncoder().encode(secret);
}

export type SessionKind = "user" | "admin";

export interface SessionPayload {
  sub: string;
  kind: SessionKind;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ kind: payload.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    if (payload.kind !== "user" && payload.kind !== "admin") return null;
    return { sub: payload.sub, kind: payload.kind };
  } catch {
    return null;
  }
}
