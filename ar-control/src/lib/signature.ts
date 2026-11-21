import { createHash, createHmac } from "node:crypto";

/**
 * Sistem 1 ↔ Sistem 2 imza sözleşmesi (ar-menu/src/lib/control/signature.ts ile birebir aynı):
 *   imzalanan = `${timestamp}.${nonce}.${METHOD}.${path}.${sha256hex(body)}`
 */
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
