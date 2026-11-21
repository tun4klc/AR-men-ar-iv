"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTenant } from "@/lib/tenant-actions";

/** Aktif/Askıda anahtarı: onay penceresi + zorunlu sebep; Sistem 1 onaylamazsa durum değişmez. */
export function StatusToggle({ tenant, disabled }: {
  tenant: { id: string; slug: string; name: string; status: "active" | "suspended" }; disabled?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(tenant.status);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const suspending = status === "active";

  const confirm = () => start(async () => {
    setError(null);
    const res = await toggleTenant({ tenantId: tenant.id, tenantSlug: tenant.slug, action: suspending ? "suspend" : "activate", reason });
    if (!res.ok) { setError(res.error); return; }
    setStatus(res.status);
    setOpen(false); setReason("");
    router.refresh();
  });

  return (
    <>
      <button
        role="switch" aria-checked={status === "active"} disabled={disabled || pending}
        onClick={() => { setOpen(true); setError(null); }}
        title={disabled ? "Canlı bağlantı yokken değiştirilemez" : suspending ? "Askıya al" : "Yeniden aç"}
        className={`relative inline-flex h-7 w-24 items-center rounded-full px-1 text-[11px] font-bold transition disabled:opacity-40 ${
          status === "active" ? "bg-ok/20 text-ok" : "bg-danger/20 text-danger"}`}
      >
        <span className={`absolute h-5 w-5 rounded-full transition-all ${status === "active" ? "left-1 bg-ok" : "left-[4.5rem] bg-danger"}`} />
        <span className={status === "active" ? "ml-7" : "ml-2"}>{status === "active" ? "AKTİF" : "ASKIDA"}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold">{suspending ? "İşletmeyi askıya al" : "İşletmeyi yeniden aç"}</h2>
            <p className="mt-2 text-sm text-muted">
              <b className="text-ink">{tenant.name}</b>{" "}
              {suspending
                ? "için menü sitesi, QR girişleri, medya ve işletme paneli derhal kapatılacak. Veriler silinmez."
                : "için menü sitesi ve panel derhal yeniden açılacak. Tüm veriler olduğu gibi geri gelir."}
            </p>
            <label className="label mt-4" htmlFor="reason">Sebep (denetim kaydına yazılır)</label>
            <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
              className="input" placeholder={suspending ? "Örn. Kasım ödemesi yapılmadı" : "Örn. Ödeme alındı"} />
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Vazgeç</button>
              <button className={suspending ? "btn-danger" : "btn-primary"} onClick={confirm} disabled={pending || reason.trim().length < 3}>
                {pending ? "Uygulanıyor…" : suspending ? "Askıya al" : "Yeniden aç"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
