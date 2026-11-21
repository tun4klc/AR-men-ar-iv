import { test } from "node:test";
import assert from "node:assert/strict";
import { guestRedirectTarget, hasSupabaseSession, isMenuPath } from "../src/lib/guest-lock.ts";

const menu = "/m/bravo/kadikoy?masa=5";

test("menü yolu tanınır", () => {
  assert.equal(isMenuPath("/m/bravo/kadikoy"), true);
  assert.equal(isMenuPath("/m/bravo"), false);
  assert.equal(isMenuPath("/dashboard/bravo"), false);
});

test("misafir ana sayfaya ve kayda giderse menüye döner", () => {
  assert.equal(guestRedirectTarget("/", menu, false), menu);
  assert.equal(guestRedirectTarget("/register", menu, false), menu);
  assert.equal(guestRedirectTarget("/olmayan-sayfa", menu, false), menu);
});

test("menü, QR, giriş ve panel yolları açık kalır", () => {
  for (const p of ["/m/baska/sube", "/q/abcdefghijklmnop", "/login", "/dashboard", "/dashboard/bravo/menu", "/auth/callback", "/askida", "/api/control/tenants"]) {
    assert.equal(guestRedirectTarget(p, menu, false), null, p);
  }
});

test("çerez yoksa veya oturum açıksa kilit yok", () => {
  assert.equal(guestRedirectTarget("/", undefined, false), null);
  assert.equal(guestRedirectTarget("/", menu, true), null);
});

test("kurcalanmış çerez dış adrese yönlendiremez", () => {
  for (const bad of ["//evil.com", "https://evil.com", "/m/bravo/kadikoy/../../x", "/login", "/m/a/b\\x"]) {
    assert.equal(guestRedirectTarget("/", bad, false), null, bad);
  }
});

test("Supabase oturum çerezi tanınır", () => {
  assert.equal(hasSupabaseSession(["sb-abc-auth-token"]), true);
  assert.equal(hasSupabaseSession(["sb-abc-auth-token.0"]), true);
  assert.equal(hasSupabaseSession(["ar_guest_menu"]), false);
});
