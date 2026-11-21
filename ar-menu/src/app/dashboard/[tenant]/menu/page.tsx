import Link from "next/link";
import { getTenantContext } from "@/lib/tenant-context";
import { formatPrice } from "@/lib/format";
import {
  addCategory, deleteCategory, moveCategory, moveProduct, quickUpdatePrice, toggleProduct, updateCategory,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MenuPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;

  const [{ data: categories }, { data: products }, { data: models }] = await Promise.all([
    ctx.supabase.from("categories").select("id, name_tr, name_en").eq("tenant_id", ctx.tenant.id).order("sort_order").order("created_at"),
    ctx.supabase.from("products").select("id, category_id, name_tr, base_price, is_active").eq("tenant_id", ctx.tenant.id).order("sort_order").order("created_at"),
    ctx.supabase.from("product_models").select("product_id").eq("tenant_id", ctx.tenant.id),
  ]);
  const withModel = new Set((models ?? []).map((m) => m.product_id));
  const base = `/dashboard/${ctx.tenant.slug}/menu`;
  const edit = ctx.canEditCatalog;
  const T = <input type="hidden" name="tenant" value={ctx.tenant.slug} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menü</h1>
          <p className="text-sm text-muted">Ürünler tüm şubelerde ortaktır; şubeye özel fiyat ve stok için Şubeler sayfasını kullanın.</p>
        </div>
        {edit && (categories?.length ?? 0) > 0 && <Link href={`${base}/products/new`} className="btn-primary">+ Yeni ürün</Link>}
      </div>

      {!edit && <p className="card text-sm text-muted">Menü içeriğini yalnızca işletme sahibi veya tüm şubelerden sorumlu yönetici düzenleyebilir.</p>}

      {edit && (
        <form action={addCategory} className="card flex flex-wrap items-end gap-3">
          {T}
          <div className="min-w-48 flex-1"><label className="label">Yeni kategori (TR)</label><input name="name_tr" required maxLength={80} className="input" placeholder="Örn. Ana Yemekler" /></div>
          <div className="min-w-48 flex-1"><label className="label">İngilizce adı (isteğe bağlı)</label><input name="name_en" maxLength={80} className="input" placeholder="Main Courses" /></div>
          <button className="btn-ghost">Kategori ekle</button>
        </form>
      )}

      {(categories ?? []).map((c, ci) => {
        const items = (products ?? []).filter((p) => p.category_id === c.id);
        return (
          <section key={c.id} className="card p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              {edit ? (
                <form action={updateCategory} className="flex flex-1 flex-wrap gap-2">
                  {T}<input type="hidden" name="id" value={c.id} />
                  <input name="name_tr" defaultValue={c.name_tr} required maxLength={80} className="input max-w-56 font-semibold" aria-label="Kategori adı" />
                  <input name="name_en" defaultValue={c.name_en ?? ""} maxLength={80} className="input max-w-48" placeholder="EN" aria-label="İngilizce adı" />
                  <button className="btn-ghost px-3 text-xs">Kaydet</button>
                </form>
              ) : <h2 className="flex-1 font-semibold">{c.name_tr}</h2>}
              {edit && (
                <div className="flex gap-1">
                  <MoveButtons action={moveCategory} tenant={ctx.tenant.slug} id={c.id} first={ci === 0} last={ci === (categories?.length ?? 0) - 1} />
                  <form action={deleteCategory}>{T}<input type="hidden" name="id" value={c.id} />
                    <button className="btn-danger px-3 text-xs" title="Kategori ve içindeki tüm ürünler silinir">Sil</button></form>
                </div>
              )}
            </div>
            {items.length === 0 ? <p className="p-4 text-sm text-muted">Bu kategoride ürün yok.</p> : (
              <ul>
                {items.map((p, pi) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line p-3 last:border-0">
                    <Link href={`${base}/products/${p.id}`} className="min-w-40 flex-1 font-medium hover:text-brand">
                      {p.name_tr}
                      {withModel.has(p.id) && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">3D/AR</span>}
                      {!p.is_active && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-muted">Gizli</span>}
                    </Link>
                    {edit ? (
                      <>
                        <form action={quickUpdatePrice} className="flex items-center gap-1">
                          {T}<input type="hidden" name="id" value={p.id} />
                          <input name="base_price" defaultValue={Number(p.base_price).toFixed(2)} inputMode="decimal" className="input w-24 text-right" aria-label="Fiyat" />
                          <span className="text-sm text-muted">₺</span>
                          <button className="btn-ghost px-2 text-xs">Kaydet</button>
                        </form>
                        <form action={toggleProduct}>{T}<input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="is_active" value={String(!p.is_active)} />
                          <button className="btn-ghost px-3 text-xs">{p.is_active ? "Gizle" : "Yayınla"}</button></form>
                        <MoveButtons action={moveProduct} tenant={ctx.tenant.slug} id={p.id} categoryId={c.id} first={pi === 0} last={pi === items.length - 1} />
                      </>
                    ) : <span className="text-sm">{formatPrice(p.base_price)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {(categories?.length ?? 0) === 0 && <p className="text-center text-muted">Başlamak için bir kategori ekleyin.</p>}
    </div>
  );
}

function MoveButtons({ action, tenant, id, categoryId, first, last }: {
  action: (f: FormData) => Promise<void>; tenant: string; id: string; categoryId?: string; first: boolean; last: boolean;
}) {
  return (
    <form action={action} className="flex gap-1">
      <input type="hidden" name="tenant" value={tenant} /><input type="hidden" name="id" value={id} />
      {categoryId && <input type="hidden" name="category_id" value={categoryId} />}
      <button name="dir" value="up" disabled={first} className="btn-ghost px-2 text-xs" aria-label="Yukarı taşı">↑</button>
      <button name="dir" value="down" disabled={last} className="btn-ghost px-2 text-xs" aria-label="Aşağı taşı">↓</button>
    </form>
  );
}
