// Kontrol Merkezi şeması: gömülü Postgres'te (PGlite) uygulanır ve kısıtlar doğrulanır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();

test("migration uygulanır, Supabase rolleri tablolara erişemez", async () => {
  await db.exec("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
  await db.exec("alter default privileges in schema public grant all on tables to anon, authenticated;");
  const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec("set role anon;");
  await assert.rejects(db.query("select * from public.admins"));
  await assert.rejects(db.query("select * from public.audit_log"));
  await db.exec("reset role;");
});

test("e-posta küçük harf zorunlu, denetim işlem türü sınırlı, request_id tekil", async () => {
  await assert.rejects(db.query("insert into public.admins (email, password_hash, totp_secret) values ('A@x.com', 'h', 's')"));
  await db.query("insert into public.admins (email, password_hash, totp_secret) values ('a@x.com', 'h', 's')");
  await assert.rejects(db.query("insert into public.audit_log (action) values ('drop_database')"));
  const id = "7d4e1c52-2c1e-4b7a-9a59-1b2c3d4e5f60";
  await db.query("insert into public.audit_log (action, request_id) values ('suspend', $1)", [id]);
  await assert.rejects(db.query("insert into public.audit_log (action, request_id) values ('suspend', $1)", [id]));
  await assert.rejects(db.query("insert into public.tenant_snapshot (id, data) values (2, '[]')"));
});
