import { requireAdmin } from "@/lib/auth";
import { loadTenants } from "@/lib/tenants";
import { Shell, StaleBanner } from "@/components/shell";
import { TenantTable } from "@/components/tenant-table";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const admin = await requireAdmin();
  const list = await loadTenants();
  return (
    <Shell email={admin.email}>
      <h1 className="mb-1 text-2xl font-bold">İşletmeler</h1>
      <p className="mb-4 text-sm text-muted">Sistemi kullanan tüm işletmeler. Sütun başlığına tıklayarak sıralayın; anahtar ile siteyi tek tıkla kapatıp açın.</p>
      {!list.live && <StaleBanner reason={list.reason} fetchedAt={list.fetchedAt} />}
      <TenantTable tenants={list.tenants} live={list.live} />
    </Shell>
  );
}
