import { SignJWT, jwtVerify } from "jose";

// Edge (middleware) ve Node'da çalışır; yalnızca imza ve süre doğrular.
export const SESSION_COOKIE = "ctl_session";
export const MFA_COOKIE = "ctl_mfa";

export type SessionClaims = { sub: string; stage: "mfa" | "full"; sv: number };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalı");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims, ttlSeconds: number): Promise<string> {
  return new SignJWT({ stage: claims.stage, sv: claims.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setAudience("ar-control")
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined, stage: "mfa" | "full"): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "ar-control", algorithms: ["HS256"] });
    if (payload.stage !== stage || typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    return { sub: payload.sub, stage, sv: payload.sv };
  } catch {
    return null;
  }
}
