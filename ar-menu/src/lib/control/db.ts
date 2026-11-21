import "server-only";
import postgres from "postgres";

// control_api rolü: hiçbir tabloya erişimi yok, yalnızca control_* fonksiyonlarını çalıştırabilir.
let sql: ReturnType<typeof postgres> | null = null;

export function controlDb() {
  if (!sql) {
    const url = process.env.CONTROL_DATABASE_URL;
    if (!url) throw new Error("CONTROL_DATABASE_URL tanımlı değil");
    sql = postgres(url, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  }
  return sql;
}

export type ControlTenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  suspended_reason: string | null;
  created_at: string;
  branch_count: number;
  scans_30d: number;
  product_views_30d: number;
  ar_opens_30d: number;
  last_activity_at: string | null;
};

export async function consumeNonce(nonce: string): Promise<boolean> {
  const rows = await controlDb()`select public.control_consume_nonce(${nonce}) as ok`;
  return rows[0]?.ok === true;
}

export async function listTenants(): Promise<ControlTenant[]> {
  const rows = await controlDb()`select * from public.control_list_tenants()`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    suspended_reason: r.suspended_reason,
    created_at: new Date(r.created_at).toISOString(),
    branch_count: Number(r.branch_count),
    scans_30d: Number(r.scans_30d),
    product_views_30d: Number(r.product_views_30d),
    ar_opens_30d: Number(r.ar_opens_30d),
    last_activity_at: r.last_activity_at ? new Date(r.last_activity_at).toISOString() : null,
  }));
}

export async function setTenantStatus(
  tenantId: string,
  status: "active" | "suspended",
  reason: string,
  requestId: string,
): Promise<{ id: string; slug: string; status: "active" | "suspended" }> {
  const rows = await controlDb()`
    select * from public.control_set_tenant_status(${tenantId}::uuid, ${status}::public.tenant_status, ${reason}, ${requestId}::uuid)`;
  const r = rows[0];
  return { id: r.id, slug: r.slug, status: r.status };
}

/** Askı bildirimini talep eder; bu komut için zaten gönderildiyse veya işletme artık askıda değilse null. */
export async function claimSuspensionNotice(
  requestId: string,
): Promise<{ tenantName: string; reason: string; emails: string[] } | null> {
  const rows = await controlDb()`select * from public.control_claim_suspension_notice(${requestId}::uuid)`;
  const r = rows[0];
  return r ? { tenantName: r.tenant_name, reason: r.reason, emails: (r.emails as string[]) ?? [] } : null;
}

export async function releaseSuspensionNotice(requestId: string): Promise<void> {
  await controlDb()`select public.control_release_suspension_notice(${requestId}::uuid)`;
}

export async function suspendedSlugs(): Promise<string[]> {
  const rows = await controlDb()`select public.control_suspended_slugs() as slugs`;
  return (rows[0]?.slugs as string[]) ?? [];
}
