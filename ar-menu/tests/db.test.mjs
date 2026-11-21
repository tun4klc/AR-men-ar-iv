// Veritabanı testleri (Docker gerektirmez): migration'lar gömülü Postgres'e (PGlite) uygulanır,
// Supabase'in auth/storage şemaları minimal taklitlerle sağlanır.
// Çalıştırma: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SUPABASE_STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema extensions; create schema auth; create schema storage;
  grant usage on schema public, extensions, auth, storage to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  -- Supabase varsayılanı: public şemadaki yeni tablolar anon/authenticated'a açık gelir.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const db = new PGlite({ extensions: { pgcrypto } });
const A = randomUUID(); // işletme sahibi
const B = randomUUID(); // başka bir kullanıcı

async function as(role, uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;

let tenantId, branchId, productId, qrToken;

test("migration'lar uygulanır", async () => {
  await db.exec(SUPABASE_STUBS);
  await db.exec("create extension if not exists pgcrypto with schema extensions;");
  const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`);
});

test("onboarding: işletme + şube + owner üyeliği", async () => {
  const slug = await as("authenticated", A, () =>
    one("select public.create_tenant_with_branch('Bravo Bistro', 'bravo', 'Kadıköy', 'kadikoy') as s"));
  assert.equal(slug.s, "bravo");
  ({ id: tenantId } = await one("select id from public.tenants where slug = 'bravo'"));
  ({ id: branchId } = await one("select id from public.branches where tenant_id = $1", [tenantId]));

  await as("authenticated", A, async () => {
    const { id: catId } = await one("insert into public.categories (tenant_id, name_tr) values ($1, 'Burgerler') returning id", [tenantId]);
    ({ id: productId } = await one(
      "insert into public.products (tenant_id, category_id, name_tr, base_price) values ($1, $2, 'Klasik Burger', 320) returning id",
      [tenantId, catId]));
    await db.query(
      `insert into public.product_models (product_id, tenant_id, glb_path, width_cm, depth_cm, height_cm)
       values ($1, $2, $3, 12, 12, 9)`, [productId, tenantId, `${tenantId}/products/${productId}/m.glb`]);
    await db.query("insert into public.branch_products (tenant_id, branch_id, product_id, price) values ($1, $2, $3, 345)",
      [tenantId, branchId, productId]);
    ({ token: qrToken } = await one("insert into public.qr_codes (tenant_id, branch_id) values ($1, $2) returning token", [tenantId, branchId]));
  });
  assert.match(qrToken, /^[A-Za-z0-9_-]{22}$/);
});

test("izolasyon: başka kullanıcı işletmeyi göremez ve yazamaz", async () => {
  await as("authenticated", B, async () => {
    assert.equal((await rows("select * from public.tenants")).length, 0);
    assert.equal((await rows("select * from public.products")).length, 0);
    await assert.rejects(db.query("insert into public.categories (tenant_id, name_tr) values ($1, 'x')", [tenantId]));
  });
});

test("anon tablolara doğrudan erişemez; owner status kolonunu değiştiremez", async () => {
  await as("anon", null, async () => {
    await assert.rejects(db.query("select * from public.tenants"));
    await assert.rejects(db.query("select * from public.events"));
  });
  await as("authenticated", A, async () => {
    await assert.rejects(db.query("update public.tenants set status = 'active' where id = $1", [tenantId]));
  });
});

test("misafir menüsü: şube fiyatı ve 3D model döner, olay kaydı çalışır", async () => {
  await as("anon", null, async () => {
    const { m } = await one("select public.get_public_menu('bravo', 'kadikoy') as m");
    assert.equal(m.status, "active");
    assert.equal(m.products.length, 1);
    assert.equal(Number(m.products[0].price), 345);
    assert.equal(Number(m.products[0].model.width_cm), 12);

    const { r } = await one("select public.resolve_qr($1) as r", [qrToken]);
    assert.deepEqual([r.status, r.tenant_slug, r.branch_slug], ["active", "bravo", "kadikoy"]);
    await db.query("select public.record_event($1, 'product_view', $2, null)", [branchId, productId]);
    await db.query("select public.record_event($1, 'ar_open', $2, null)", [branchId, productId]);
    await assert.rejects(db.query("select public.record_event($1, 'qr_scan', null, null)", [branchId]));
  });
});

test("analitik: dashboard_stats en çok bakılan ürünü ve şube kırılımını döndürür", async () => {
  const { s } = await as("authenticated", A, () => one(
    "select public.dashboard_stats($1, now() - interval '1 day', now() + interval '1 minute') as s", [tenantId]));
  assert.equal(Number(s.totals.qr_scans), 1);
  assert.equal(s.top_products[0].name, "Klasik Burger");
  assert.equal(Number(s.top_products[0].ar_opens), 1);
  assert.equal(s.by_branch.length, 1);
  await as("authenticated", B, async () => {
    await assert.rejects(db.query("select public.dashboard_stats($1, now() - interval '1 day', now())", [tenantId]));
  });
});

test("control_api rolü: tablolara erişemez, yalnızca control_* fonksiyonları", async () => {
  await as("control_api", null, async () => {
    await assert.rejects(db.query("select * from public.tenants"));
    await assert.rejects(db.query("select * from public.products"));
    await assert.rejects(db.query("select public.get_public_menu('bravo', 'kadikoy')"));
    const list = await rows("select * from public.control_list_tenants()");
    assert.equal(list.length, 1);
    assert.equal(Number(list[0].scans_30d), 1);
    assert.equal(Number(list[0].ar_opens_30d), 1);
    assert.ok(!("products" in list[0]));
  });
  await as("anon", null, async () => {
    await assert.rejects(db.query("select * from public.control_list_tenants()"));
  });
  await as("authenticated", A, async () => {
    await assert.rejects(db.query("select * from public.control_set_tenant_status($1, 'active', 'hack', $2)", [tenantId, randomUUID()]));
  });
});

test("nonce yalnızca bir kez kullanılabilir (replay koruması)", async () => {
  await as("control_api", null, async () => {
    const n = randomUUID();
    assert.equal((await one("select public.control_consume_nonce($1) as ok", [n])).ok, true);
    assert.equal((await one("select public.control_consume_nonce($1) as ok", [n])).ok, false);
  });
});

test("KILL-SWITCH: askıya alınınca tüm veri yolları kesilir", async () => {
  const req = randomUUID();
  await as("control_api", null, async () => {
    const r = await one("select * from public.control_set_tenant_status($1, 'suspended', 'Ödeme yapılmadı', $2)", [tenantId, req]);
    assert.equal(r.status, "suspended");
    assert.deepEqual((await one("select public.control_suspended_slugs() as s")).s, ["bravo"]);
  });

  const before = (await one("select count(*)::int as c from public.events")).c;
  await as("anon", null, async () => {
    const { m } = await one("select public.get_public_menu('bravo', 'kadikoy') as m");
    assert.deepEqual(m, { status: "suspended" });                       // menü verisi YOK
    assert.deepEqual((await one("select public.resolve_qr($1) as r", [qrToken])).r, { status: "suspended" });
    await db.query("select public.record_event($1, 'product_view', $2, null)", [branchId, productId]);
    // Storage okuma politikası (imzalı URL üretimi) bu fonksiyona bağlı → medya da kapalı
    assert.equal((await one("select public.is_tenant_active($1) as a", [tenantId])).a, false);
  });
  assert.equal((await one("select count(*)::int as c from public.events")).c, before); // olay yazılmadı

  await as("authenticated", A, async () => {
    for (const t of ["tenants", "branches", "categories", "products", "product_models", "branch_products", "qr_codes"]) {
      assert.equal((await rows(`select * from public.${t}`)).length, 0, `${t} askıdayken boş olmalı`);
    }
    const upd = await db.query("update public.products set base_price = 1 where id = $1", [productId]);
    assert.equal(upd.affectedRows ?? 0, 0);
    await assert.rejects(db.query("insert into public.categories (tenant_id, name_tr) values ($1, 'x')", [tenantId]));
    await assert.rejects(db.query("select public.dashboard_stats($1, now() - interval '1 day', now())", [tenantId]));
    const mine = await rows("select * from public.my_tenants()");
    assert.deepEqual(mine.map((x) => [x.slug, x.status]), [["bravo", "suspended"]]); // panel "askıda" ekranı gösterebilir
  });
});

test("aynı request_id ikinci kez uygulanmaz (idempotent)", async () => {
  await as("control_api", null, async () => {
    const req = randomUUID();
    await db.query("select * from public.control_set_tenant_status($1, 'active', 'Ödeme alındı', $2)", [tenantId, req]);
    await db.query("select * from public.control_set_tenant_status($1, 'suspended', 'tekrar', $2)", [tenantId, randomUUID()]);
    const r = await one("select * from public.control_set_tenant_status($1, 'active', 'Ödeme alındı', $2)", [tenantId, req]);
    assert.equal(r.status, "suspended"); // eski istek tekrar oynatılınca durum değişmedi
  });
});

test("askı bildirimi: owner e-postası döner, aynı komut için bir kez", async () => {
  // Durum kaydını sonraki testler için değiştirmemek adına işlem sonunda geri alınır.
  await db.exec("begin");
  try { await suspensionNoticeChecks(); } finally { await db.exec("rollback"); }
  // Misafir ve işletme kullanıcısı bu fonksiyonları çağıramaz (e-posta listesi sızmaz).
  await as("anon", null, () => assert.rejects(db.query("select * from public.control_claim_suspension_notice($1)", [randomUUID()])));
  await as("authenticated", A, () => assert.rejects(db.query("select * from public.control_claim_suspension_notice($1)", [randomUUID()])));
});

async function suspensionNoticeChecks() {
  await db.query("update auth.users set email = 'sahip@bravo.test' where id = $1", [A]);
  await db.query("update auth.users set email = 'yabanci@test' where id = $1", [B]);
  const req = randomUUID();
  await as("control_api", null, async () => {
    await db.query("select * from public.control_set_tenant_status($1, 'suspended', 'Ödeme yapılmadı', $2)", [tenantId, req]);
    const n = await one("select * from public.control_claim_suspension_notice($1)", [req]);
    assert.equal(n.tenant_name, "Bravo Bistro");
    assert.equal(n.reason, "Ödeme yapılmadı");
    assert.deepEqual(n.emails, ["sahip@bravo.test"]); // başka işletmenin kullanıcısı yok
    assert.equal(await one("select * from public.control_claim_suspension_notice($1)", [req]), undefined); // ikinci kez yok

    await db.query("select public.control_release_suspension_notice($1)", [req]); // gönderim başarısız → tekrar denenebilir
    assert.ok(await one("select * from public.control_claim_suspension_notice($1)", [req]));

    const act = randomUUID();
    await db.query("select * from public.control_set_tenant_status($1, 'active', 'Ödeme alındı', $2)", [tenantId, act]);
    assert.equal(await one("select * from public.control_claim_suspension_notice($1)", [act]), undefined); // açma bildirimi değil
    await db.query("select * from public.control_set_tenant_status($1, 'suspended', 'tekrar', $2)", [tenantId, randomUUID()]);
  });
}

test("tekrar açınca veriler olduğu gibi geri gelir", async () => {
  await as("control_api", null, () =>
    db.query("select * from public.control_set_tenant_status($1, 'active', 'Ödeme alındı', $2)", [tenantId, randomUUID()]));
  await as("anon", null, async () => {
    const { m } = await one("select public.get_public_menu('bravo', 'kadikoy') as m");
    assert.equal(m.status, "active");
    assert.equal(Number(m.products[0].price), 345);
  });
  await as("authenticated", A, async () => {
    assert.equal((await rows("select * from public.products")).length, 1);
  });
  const t = await one("select status, suspended_at, suspended_reason from public.tenants where id = $1", [tenantId]);
  assert.deepEqual([t.status, t.suspended_at, t.suspended_reason], ["active", null, null]);
  const log = await rows("select action from public.tenant_status_log where tenant_id = $1 order by id", [tenantId]);
  assert.deepEqual(log.map((l) => l.action), ["suspended", "active", "suspended", "active"]);
});
