import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { formatPrice } from "@/lib/format";
import { saveBranchProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function BranchPrices({ params }: { params: Promise<{ tenant: string; branchId: string }> }) {
  const { tenant: slug, branchId } = await params;
  if (!z.uuid().safeParse(branchId).success) notFound();
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;

  const [{ data: branch }, { data: products }, { data: overrides }, { data: categories }] = await Promise.all([
    ctx.supabase.from("branches").select("id, name").eq("id", branchId).eq("tenant_id", ctx.tenant.id).maybeSingle(),
    ctx.supabase.from("products").select("id, name_tr, base_price, category_id, is_active").eq("tenant_id", ctx.tenant.id).order("sort_order"),
    ctx.supabase.from("branch_products").select("product_id, price, is_available, is_hidden").eq("branch_id", branchId),
    ctx.supabase.from("categories").select("id, name_tr").eq("tenant_id", ctx.tenant.id).order("sort_order"),
  ]);
  if (!branch) notFound();
  const byId = new Map((overrides ?? []).map((o) => [o.product_id, o]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/dashboard/${ctx.tenant.slug}/branches`} className="text-sm text-muted hover:text-brand">← Şubeler</Link>
        <h1 className="text-2xl font-bold">{branch.name} — fiyat ve stok</h1>
        <p className="text-sm text-muted">Fiyatı boş bırakırsanız ürünün varsayılan fiyatı kullanılır.</p>
      </div>
      {(categories ?? []).map((c) => {
        const items = (products ?? []).filter((p) => p.category_id === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="card p-0">
            <h2 className="border-b border-line p-3 font-semibold">{c.name_tr}</h2>
            <ul>
              {items.map((p) => {
                const o = byId.get(p.id);
                return (
                  <li key={p.id} className="border-b border-line p-3 last:border-0">
                    <form action={saveBranchProduct} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="tenant" value={ctx.tenant.slug} />
                      <input type="hidden" name="branch_id" value={branch.id} />
                      <input type="hidden" name="product_id" value={p.id} />
                      <span className="min-w-40 flex-1 font-medium">{p.name_tr}{!p.is_active && <span className="ml-2 text-xs text-muted">(menüde gizli)</span>}</span>
                      <span className="text-xs text-muted">Varsayılan {formatPrice(p.base_price)}</span>
                      <input name="price" defaultValue={o?.price != null ? Number(o.price).toFixed(2) : ""} placeholder="Şube fiyatı"
                        inputMode="decimal" className="input w-28 text-right" aria-label="Şube fiyatı" />
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_available" defaultChecked={o?.is_available ?? true} /> Stokta</label>
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_hidden" defaultChecked={o?.is_hidden ?? false} /> Bu şubede gizle</label>
                      <button className="btn-ghost px-3 text-xs">Kaydet</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
