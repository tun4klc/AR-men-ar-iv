import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session-token";

export type Admin = { id: string; email: string };

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Her korumalı sayfa/aksiyon bunu çağırır: imzalı çerez + veritabanında hâlâ aktif mi +
 * session_version eşleşiyor mu (çıkış/parola değişiminde tüm oturumlar düşer).
 */
export async function requireAdmin(): Promise<Admin> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, "full");
  if (!claims) redirect("/login");
  const [row] = await db()`
    select id, email from public.admins
    where id = ${claims.sub} and is_active and session_version = ${claims.sv}`;
  if (!row) redirect("/login");
  return { id: row.id, email: row.email };
}

export async function audit(entry: {
  adminId?: string | null; adminEmail?: string | null; action: string; tenantId?: string | null; tenantSlug?: string | null;
  reason?: string | null; requestId?: string | null; upstreamStatus?: number | null; outcome?: "pending" | "ok" | "failed" | null;
}) {
  const ip = await clientIp();
  await db()`
    insert into public.audit_log (admin_id, admin_email, action, tenant_id, tenant_slug, reason, ip, request_id, upstream_status, outcome)
    values (${entry.adminId ?? null}, ${entry.adminEmail ?? null}, ${entry.action}, ${entry.tenantId ?? null},
            ${entry.tenantSlug ?? null}, ${entry.reason ?? null}, ${ip}, ${entry.requestId ?? null},
            ${entry.upstreamStatus ?? null}, ${entry.outcome ?? null})`;
}
