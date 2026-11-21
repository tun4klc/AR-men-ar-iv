import { test } from "node:test";
import assert from "node:assert/strict";
import { signRequest } from "../src/lib/signature.ts";

// Sözleşme sabiti: ar-menu'daki doğrulayıcı aynı girdiden aynı imzayı üretmelidir.
// Bu değer değişirse iki sistem birbirini reddeder — iki repoda birlikte güncelleyin.
test("imza sözleşmesi sabit test vektörüyle uyuşur", () => {
  const sig = signRequest("a".repeat(64), {
    timestamp: "1800000000", nonce: "0f8b6a52-1c1e-4b7a-9a59-1b2c3d4e5f60",
    method: "post", path: "/api/control/tenants/x/suspend", body: '{"reason":"test"}',
  });
  assert.equal(sig, "e14a9bfbe40521b901ae13627ead9d7c298dac08cfcbda40cdc974297523028d");
  assert.match(sig, /^[a-f0-9]{64}$/);
});
