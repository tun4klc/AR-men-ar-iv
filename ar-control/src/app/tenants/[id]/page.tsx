import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadTenants } from "@/lib/tenants";
import { Shell, StaleBanner } from "@/components/shell";
import { StatusToggle } from "@/components/status-toggle";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("tr-TR");

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const list = await loadTenants();
  const t = list.tenants.find((x) => x.id === id);
  if (!t) notFound();
  const history = await db()`
    select action, admin_email, reason, outcome, upstream_status, created_at from public.audit_log
    where tenant_id = ${id} order by created_at desc limit 50`;

  const stats = [
    ["Şube", t.branch_count], ["QR tarama (30g)", t.scans_30d],
    ["Ürün görüntüleme (30g)", t.product_views_30d], ["AR açılma (30g)", t.ar_opens_30d],
  ] as const;

  return (
    <Shell email={admin.email}>
      <Link href="/" className="text-sm text-muted hover:text-brand">← İşletmeler</Link>
      {!list.live && <div className="mt-3"><StaleBanner reason={list.reason} fetchedAt={list.fetchedAt} /></div>}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">{t.name}</h1>
        <StatusToggle tenant={t} disabled={!list.live} />
      </div>
      <p className="text-sm text-muted">{t.slug} · kayıt {new Date(t.created_at).toLocaleDateString("tr-TR")}
        {t.last_activity_at && ` · son aktivite ${new Date(t.last_activity_at).toLocaleString("tr-TR")}`}</p>
      {t.status === "suspended" && t.suspended_reason && (
        <p className="mt-2 text-sm text-danger">Askıya alma sebebi: {t.suspended_reason}</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, v]) => (
          <div key={label} className="card"><p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{nf.format(v)}</p></div>
        ))}
      </div>
      <h2 className="mb-2 mt-8 font-semibold">Aç/kapat geçmişi</h2>
      <AuditTable rows={history.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })) as AuditRow[]} />
    </Shell>
  );
}

type AuditRow = { action: string; admin_email: string | null; reason: string | null; outcome: string | null; upstream_status: number | null; created_at: string };

function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted">Henüz işlem yok.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-card text-left text-xs text-muted"><tr><th className="px-3 py-2">Zaman</th><th>İşlem</th><th>Yönetici</th><th>Sebep</th><th>Sonuç</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-3 py-2">{new Date(r.created_at).toLocaleString("tr-TR")}</td>
              <td>{r.action === "suspend" ? "Askıya alındı" : "Açıldı"}</td>
              <td>{r.admin_email}</td>
              <td>{r.reason}</td>
              <td className={r.outcome === "ok" ? "text-ok" : r.outcome === "failed" ? "text-danger" : "text-muted"}>
                {r.outcome === "ok" ? "Uygulandı" : r.outcome === "failed" ? `Uygulanmadı (${r.upstream_status})` : "Beklemede"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
