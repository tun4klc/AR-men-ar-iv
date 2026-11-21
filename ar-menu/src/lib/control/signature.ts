import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sistem 1 ↔ Sistem 2 imza sözleşmesi (iki repoda da birebir aynı olmalı):
 *   imzalanan = `${timestamp}.${nonce}.${METHOD}.${path}.${sha256hex(body)}`
 *   x-ctl-signature = hex(HMAC-SHA256(secret, imzalanan))
 */
export const MAX_SKEW_SECONDS = 60;

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function signRequest(
  secret: string,
  parts: { timestamp: string; nonce: string; method: string; path: string; body: string },
): string {
  const payload = [parts.timestamp, parts.nonce, parts.method.toUpperCase(), parts.path, sha256Hex(parts.body)].join(".");
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export type VerifyResult = { ok: true; nonce: string } | { ok: false; reason: string };

export function verifyRequest(
  secret: string,
  input: {
    method: string;
    path: string;
    body: string;
    timestamp: string | null;
    nonce: string | null;
    signature: string | null;
    nowSeconds?: number;
  },
): VerifyResult {
  const { timestamp, nonce, signature } = input;
  if (!secret || secret.length < 32) return { ok: false, reason: "server_misconfigured" };
  if (!timestamp || !nonce || !signature) return { ok: false, reason: "missing_headers" };
  if (!/^\d{10}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  if (!/^[A-Za-z0-9-]{16,64}$/.test(nonce)) return { ok: false, reason: "bad_nonce" };
  if (!/^[a-f0-9]{64}$/.test(signature)) return { ok: false, reason: "bad_signature" };

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) return { ok: false, reason: "expired" };

  const expected = signRequest(secret, { timestamp, nonce, method: input.method, path: input.path, body: input.body });
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true, nonce };
}
