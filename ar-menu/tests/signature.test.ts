import { test } from "node:test";
import assert from "node:assert/strict";
import { signRequest, verifyRequest } from "../src/lib/control/signature.ts";

const secret = "a".repeat(64);
const now = 1_800_000_000;
const base = { method: "POST", path: "/api/control/tenants/x/suspend", body: '{"reason":"test"}', nonce: "0f8b6a52-1c1e-4b7a-9a59-1b2c3d4e5f60" };
const sign = (o: Partial<typeof base> & { timestamp?: string } = {}) => {
  const p = { ...base, timestamp: String(now), ...o };
  return { ...p, signature: signRequest(secret, p) };
};

test("geçerli imza kabul edilir", () => {
  assert.deepEqual(verifyRequest(secret, { ...sign(), nowSeconds: now }), { ok: true, nonce: base.nonce });
});

test("gövde, yol veya yöntem değişirse reddedilir", () => {
  const s = sign();
  for (const tamper of [{ body: '{"reason":"x"}' }, { path: "/api/control/tenants/y/suspend" }, { method: "GET" }]) {
    const r = verifyRequest(secret, { ...s, ...tamper, nowSeconds: now });
    assert.equal(r.ok, false);
  }
});

test("yanlış anahtar reddedilir", () => {
  const s = sign();
  assert.equal(verifyRequest("b".repeat(64), { ...s, nowSeconds: now }).ok, false);
});

test("60 saniyeden eski/ileri zaman damgası reddedilir", () => {
  const s = sign({ timestamp: String(now - 61) });
  assert.deepEqual(verifyRequest(secret, { ...s, nowSeconds: now }), { ok: false, reason: "expired" });
});

test("eksik başlık ve kısa sır reddedilir", () => {
  assert.equal(verifyRequest(secret, { ...base, timestamp: null, nonce: null, signature: null }).ok, false);
  assert.deepEqual(verifyRequest("short", { ...sign(), nowSeconds: now }), { ok: false, reason: "server_misconfigured" });
});

// Sözleşme sabiti — ar-control/tests/signature.test.ts ile aynı vektör. İki repoda birlikte güncelleyin.
test("imza sözleşmesi sabit test vektörüyle uyuşur", () => {
  const sig = signRequest(secret, { timestamp: "1800000000", nonce: base.nonce, method: "POST", path: base.path, body: base.body });
  assert.equal(sig, "e14a9bfbe40521b901ae13627ead9d7c298dac08cfcbda40cdc974297523028d");
});
