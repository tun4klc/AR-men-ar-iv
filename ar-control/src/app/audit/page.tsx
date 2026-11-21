import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  login: "Giriş", login_failed: "Hatalı giriş", login_locked: "Hesap kilitlendi", logout: "Çıkış",
  suspend: "Askıya alma", activate: "Yeniden açma",
};

export default async function AuditPage() {
  const admin = await requireAdmin();
  const rows = await db()`
    select action, admin_email, tenant_slug, reason, ip, outcome, upstream_status, created_at
    from public.audit_log order by created_at desc limit 300`;
  return (
    <Shell email={admin.email}>
      <h1 className="mb-4 text-2xl font-bold">Denetim kaydı</h1>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-card text-left text-xs text-muted">
            <tr><th className="px-3 py-2">Zaman</th><th>İşlem</th><th>Yönetici</th><th>İşletme</th><th>Sebep</th><th>IP</th><th>Sonuç</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("tr-TR")}</td>
                <td className={r.action.startsWith("login_") ? "text-danger" : ""}>{LABEL[r.action] ?? r.action}</td>
                <td>{r.admin_email ?? "—"}</td>
                <td>{r.tenant_slug ?? "—"}</td>
                <td className="max-w-64 truncate">{r.reason ?? ""}</td>
                <td className="text-xs text-muted">{r.ip ?? ""}</td>
                <td className={r.outcome === "ok" ? "text-ok" : r.outcome === "failed" ? "text-danger" : "text-muted"}>
                  {r.outcome === "ok" ? "Uygulandı" : r.outcome === "failed" ? `Uygulanmadı (${r.upstream_status})` : r.outcome ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
