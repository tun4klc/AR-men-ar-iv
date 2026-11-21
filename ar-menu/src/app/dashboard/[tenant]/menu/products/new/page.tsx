import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-context";
import { ProductForm } from "../product-form";
import { createProduct } from "../../actions";

export default async function NewProduct({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;
  if (!ctx.canEditCatalog) notFound();
  const { data: categories } = await ctx.supabase.from("categories").select("id, name_tr").eq("tenant_id", ctx.tenant.id).order("sort_order");
  if (!categories?.length) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Yeni ürün</h1>
      <p className="text-sm text-muted">Ürünü oluşturduktan sonra görsel ve 3D model ekleyebilirsiniz.</p>
      <ProductForm tenant={ctx.tenant.slug} categories={categories} action={createProduct} />
    </div>
  );
}
