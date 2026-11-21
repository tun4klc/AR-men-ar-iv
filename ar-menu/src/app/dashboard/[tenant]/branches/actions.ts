"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveTenant } from "@/lib/tenant-context";
import { slugify } from "@/lib/format";

const uuid = z.uuid();

async function ctxFrom(form: FormData) {
  return requireActiveTenant(String(form.get("tenant") ?? ""));
}

export async function addBranch(form: FormData) {
  const ctx = await ctxFrom(form);
  if (!ctx.isOwner) throw new Error("Yalnızca işletme sahibi şube ekleyebilir.");
  const name = z.string().trim().min(1).max(120).parse(form.get("name"));
  const address = z.string().trim().max(300).parse(form.get("address") ?? "") || null;
  const slug = slugify(name) || "sube";
  const { error } = await ctx.supabase.from("branches").insert({ tenant_id: ctx.tenant.id, name, address, slug, is_published: false });
  if (error?.code === "23505") throw new Error("Bu adla bir şube zaten var.");
  if (error) throw new Error("Şube eklenemedi.");
  revalidatePath(`/dashboard/${ctx.tenant.slug}`, "layout");
}

export async function updateBranch(form: FormData) {
  const ctx = await ctxFrom(form);
  const id = uuid.parse(form.get("id"));
  const name = z.string().trim().min(1).max(120).parse(form.get("name"));
  const address = z.string().trim().max(300).parse(form.get("address") ?? "") || null;
  await ctx.supabase.from("branches").update({ name, address }).eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}`, "layout");
}

export async function setBranchPublished(form: FormData) {
  const ctx = await ctxFrom(form);
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("branches").update({ is_published: form.get("value") === "true" })
    .eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}`, "layout");
}

export async function deleteBranch(form: FormData) {
  const ctx = await ctxFrom(form);
  if (!ctx.isOwner) throw new Error("Yalnızca işletme sahibi şube silebilir.");
  const id = uuid.parse(form.get("id"));
  const { count } = await ctx.supabase.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id);
  if ((count ?? 0) <= 1) throw new Error("Son şube silinemez.");
  await ctx.supabase.from("branches").delete().eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}`, "layout");
}

/** Şubeye özel fiyat / stok / gizleme. Boş fiyat = varsayılan fiyat kullanılır. */
export async function saveBranchProduct(form: FormData) {
  const ctx = await ctxFrom(form);
  const branch_id = uuid.parse(form.get("branch_id"));
  const product_id = uuid.parse(form.get("product_id"));
  const rawPrice = String(form.get("price") ?? "").trim().replace(",", ".");
  const price = rawPrice === "" ? null : z.coerce.number().min(0).max(1_000_000).parse(rawPrice);
  await ctx.supabase.from("branch_products").upsert({
    tenant_id: ctx.tenant.id, branch_id, product_id, price,
    is_available: form.get("is_available") === "on",
    is_hidden: form.get("is_hidden") === "on",
  }).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}/branches/${branch_id}`);
}
