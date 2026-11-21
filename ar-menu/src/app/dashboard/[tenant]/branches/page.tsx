import Link from "next/link";
import { getTenantContext } from "@/lib/tenant-context";
import { addBranch, deleteBranch, setBranchPublished, updateBranch } from "./actions";

export const dynamic = "force-dynamic";

export default async function BranchesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;
  const { data: branches } = await ctx.supabase.from("branches").select("*").eq("tenant_id", ctx.tenant.id).order("created_at");
  const T = <input type="hidden" name="tenant" value={ctx.tenant.slug} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Şubeler</h1>
        <p className="text-sm text-muted">Her şubenin kendi menü adresi, fiyatları, stok durumu ve istatistikleri vardır.</p>
      </div>
      {ctx.isOwner && (
        <form action={addBranch} className="card flex flex-wrap items-end gap-3">
          {T}
          <div className="min-w-48 flex-1"><label className="label">Yeni şube adı</label><input name="name" required maxLength={120} className="input" placeholder="Örn. Beşiktaş" /></div>
          <div className="min-w-48 flex-[2]"><label className="label">Adres (isteğe bağlı)</label><input name="address" maxLength={300} className="input" /></div>
          <button className="btn-ghost">Şube ekle</button>
        </form>
      )}
      <ul className="flex flex-col gap-3">
        {(branches ?? []).map((b) => (
          <li key={b.id} className="card flex flex-col gap-3">
            <form action={updateBranch} className="flex flex-wrap items-end gap-2">
              {T}<input type="hidden" name="id" value={b.id} />
              <div className="min-w-40 flex-1"><label className="label">Şube adı</label><input name="name" defaultValue={b.name} required className="input" /></div>
              <div className="min-w-48 flex-[2]"><label className="label">Adres</label><input name="address" defaultValue={b.address ?? ""} className="input" /></div>
              <button className="btn-ghost">Kaydet</button>
            </form>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${b.is_published ? "bg-ok/10 text-ok" : "bg-stone-100 text-muted"}`}>
                {b.is_published ? "Yayında" : "Yayında değil"}
              </span>
              <code className="text-xs text-muted">/m/{ctx.tenant.slug}/{b.slug}</code>
              <div className="ml-auto flex flex-wrap gap-2">
                {b.is_published && <a href={`/m/${ctx.tenant.slug}/${b.slug}`} target="_blank" className="btn-ghost px-3 text-xs">Menüyü aç ↗</a>}
                <Link href={`/dashboard/${ctx.tenant.slug}/branches/${b.id}`} className="btn-ghost px-3 text-xs">Fiyat ve stok</Link>
                <form action={setBranchPublished}>{T}<input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="value" value={String(!b.is_published)} />
                  <button className="btn-ghost px-3 text-xs">{b.is_published ? "Yayından kaldır" : "Yayınla"}</button></form>
                {ctx.isOwner && (branches?.length ?? 0) > 1 && (
                  <form action={deleteBranch}>{T}<input type="hidden" name="id" value={b.id} />
                    <button className="btn-danger px-3 text-xs">Sil</button></form>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
