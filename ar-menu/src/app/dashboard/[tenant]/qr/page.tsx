import QRCode from "qrcode";
import { getTenantContext } from "@/lib/tenant-context";
import { publicEnv } from "@/lib/env";
import { addBranchQr, addTables, deleteTable, regenerateQr, setQrActive } from "./actions";

export const dynamic = "force-dynamic";

type Qr = { id: string; token: string; is_active: boolean; branch_id: string; table_id: string | null; created_at: string };

export default async function QrPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;

  const [{ data: branches }, { data: tables }, { data: codes }] = await Promise.all([
    ctx.supabase.from("branches").select("id, name").eq("tenant_id", ctx.tenant.id).order("created_at"),
    ctx.supabase.from("tables").select("id, label, branch_id").eq("tenant_id", ctx.tenant.id).order("created_at"),
    ctx.supabase.from("qr_codes").select("id, token, is_active, branch_id, table_id, created_at").eq("tenant_id", ctx.tenant.id).order("created_at", { ascending: false }),
  ]);

  const site = publicEnv.siteUrl();
  const render = async (q: Qr) => {
    const url = `${site}/q/${q.token}`;
    const [png, svg] = await Promise.all([
      QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" }),
      QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }),
    ]);
    return { ...q, url, png, svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
  };
  const rendered = await Promise.all(((codes ?? []) as Qr[]).map(render));
  const T = <input type="hidden" name="tenant" value={ctx.tenant.slug} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">QR kodlar</h1>
        <p className="text-sm text-muted">Her masa için ayrı kod üretin; hangi masadan tarandığı istatistiklere yansır. Kodlar tahmin edilemez ve istediğiniz an pasifleştirilebilir.</p>
      </div>
      {(branches ?? []).map((b) => {
        const branchTables = (tables ?? []).filter((t) => t.branch_id === b.id);
        const branchCodes = rendered.filter((q) => q.branch_id === b.id);
        const general = branchCodes.filter((q) => !q.table_id);
        return (
          <section key={b.id} className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">{b.name}</h2>
              <div className="flex flex-wrap gap-2">
                <form action={addTables} className="flex gap-2">
                  {T}<input type="hidden" name="branch_id" value={b.id} />
                  <input name="labels" required placeholder="Masalar: 1-20 veya Bahçe 1, Bahçe 2" className="input w-64" aria-label="Masa etiketleri" />
                  <button className="btn-ghost">Masa ekle</button>
                </form>
                <form action={addBranchQr}>{T}<input type="hidden" name="branch_id" value={b.id} />
                  <button className="btn-ghost">Genel QR üret</button></form>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[...general.map((q) => ({ q, label: "Genel", tableId: null as string | null })),
                ...branchTables.flatMap((t) => branchCodes.filter((q) => q.table_id === t.id).map((q) => ({ q, label: `Masa ${t.label}`, tableId: t.id })))]
                .map(({ q, label, tableId }) => (
                  <div key={q.id} className={`flex flex-col items-center gap-2 rounded-lg border p-3 ${q.is_active ? "border-line" : "border-dashed border-line opacity-50"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.png} alt={`${label} QR`} className="aspect-square w-full" />
                    <p className="text-sm font-semibold">{label}</p>
                    {q.is_active ? (
                      <div className="flex flex-wrap justify-center gap-1 text-xs">
                        <a href={q.png} download={`${b.name}-${label}.png`} className="btn-ghost px-2 py-1 text-xs">PNG</a>
                        <a href={q.svg} download={`${b.name}-${label}.svg`} className="btn-ghost px-2 py-1 text-xs">SVG</a>
                        <form action={regenerateQr}>{T}<input type="hidden" name="id" value={q.id} />
                          <button className="btn-ghost px-2 py-1 text-xs" title="Eski kod çalışmaz olur">Yenile</button></form>
                        <form action={setQrActive}>{T}<input type="hidden" name="id" value={q.id} /><input type="hidden" name="value" value="false" />
                          <button className="btn-danger px-2 py-1 text-xs">Pasifleştir</button></form>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <form action={setQrActive}>{T}<input type="hidden" name="id" value={q.id} /><input type="hidden" name="value" value="true" />
                          <button className="btn-ghost px-2 py-1 text-xs">Etkinleştir</button></form>
                        {tableId && <form action={deleteTable}>{T}<input type="hidden" name="id" value={tableId} />
                          <button className="btn-danger px-2 py-1 text-xs">Masayı sil</button></form>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {branchCodes.length === 0 && <p className="text-sm text-muted">Bu şube için henüz QR kod yok.</p>}
          </section>
        );
      })}
    </div>
  );
}
