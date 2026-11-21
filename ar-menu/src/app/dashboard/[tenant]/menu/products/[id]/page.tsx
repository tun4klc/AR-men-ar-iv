import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { signPaths } from "@/lib/media";
import { ProductForm } from "../product-form";
import { deleteProduct, updateProduct } from "../../actions";
import { MediaManager } from "./media-manager";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;

  const [{ data: product }, { data: categories }, { data: model }] = await Promise.all([
    ctx.supabase.from("products").select("*").eq("id", id).eq("tenant_id", ctx.tenant.id).maybeSingle(),
    ctx.supabase.from("categories").select("id, name_tr").eq("tenant_id", ctx.tenant.id).order("sort_order"),
    ctx.supabase.from("product_models").select("*").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();

  const urls = await signPaths(ctx.supabase, [product.image_path, model?.glb_path, model?.usdz_path, model?.poster_path]);
  const url = (p?: string | null) => (p ? urls.get(p) ?? null : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/dashboard/${ctx.tenant.slug}/menu`} className="text-sm text-muted hover:text-brand">← Menü</Link>
          <h1 className="text-2xl font-bold">{product.name_tr}</h1>
        </div>
        {ctx.canEditCatalog && (
          <form action={deleteProduct}>
            <input type="hidden" name="tenant" value={ctx.tenant.slug} /><input type="hidden" name="id" value={product.id} />
            <button className="btn-danger">Ürünü sil</button>
          </form>
        )}
      </div>
      {ctx.canEditCatalog ? (
        <>
          <ProductForm version={String(product.updated_at)} tenant={ctx.tenant.slug} categories={categories ?? []} values={product} action={updateProduct} />
          <MediaManager
            tenantSlug={ctx.tenant.slug}
            tenantId={ctx.tenant.id}
            productId={product.id}
            image={product.image_path ? { path: product.image_path, url: url(product.image_path) } : null}
            model={model ? {
              glb: { path: model.glb_path, url: url(model.glb_path) },
              usdz: model.usdz_path ? { path: model.usdz_path, url: url(model.usdz_path) } : null,
              poster: model.poster_path ? { path: model.poster_path, url: url(model.poster_path) } : null,
              width_cm: Number(model.width_cm), depth_cm: Number(model.depth_cm), height_cm: Number(model.height_cm),
            } : null}
          />
        </>
      ) : <p className="card text-sm text-muted">Bu ürünü düzenleme yetkiniz yok.</p>}
    </div>
  );
}
