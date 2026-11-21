import "server-only";
import { db } from "./db";
import { fetchTenants, MenuApiError, type Tenant } from "./menu-api";

export type TenantList = { tenants: Tenant[]; live: true } | { tenants: Tenant[]; live: false; fetchedAt: string | null; reason: string };

/** Canlı listeyi çeker; Sistem 1'e ulaşılamazsa son bilinen listeyi "eski veri" olarak döner. */
export async function loadTenants(): Promise<TenantList> {
  try {
    const tenants = await fetchTenants();
    await db()`
      insert into public.tenant_snapshot (id, data, fetched_at) values (1, ${db().json(tenants)}, now())
      on conflict (id) do update set data = excluded.data, fetched_at = excluded.fetched_at`;
    return { tenants, live: true };
  } catch (e) {
    const reason = e instanceof MenuApiError
      ? e.status === 0 ? "Menü Platformu'na ulaşılamıyor." : `Menü Platformu isteği reddetti (${e.status} ${e.code}).`
      : "Beklenmeyen hata.";
    const [snap] = await db()`select data, fetched_at from public.tenant_snapshot where id = 1`;
    return {
      tenants: (snap?.data as Tenant[]) ?? [],
      live: false,
      fetchedAt: snap ? new Date(snap.fetched_at).toISOString() : null,
      reason,
    };
  }
}
