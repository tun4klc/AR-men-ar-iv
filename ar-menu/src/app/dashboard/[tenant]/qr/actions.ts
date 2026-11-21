"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveTenant } from "@/lib/tenant-context";

const uuid = z.uuid();

export async function addTables(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  const branch_id = uuid.parse(form.get("branch_id"));
  // "1-10" aralığı veya virgülle ayrılmış etiketler: "Bahçe 1, Bahçe 2"
  const raw = z.string().trim().min(1).max(500).parse(form.get("labels"));
  const range = raw.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
  const labels = range
    ? Array.from({ length: Math.min(200, Number(range[2]) - Number(range[1]) + 1) }, (_, i) => String(Number(range[1]) + i))
    : raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (!labels.length || labels.some((l) => l.length > 40)) throw new Error("Geçersiz masa etiketi.");

  const { data: tables, error } = await ctx.supabase.from("tables")
    .upsert(labels.map((label) => ({ tenant_id: ctx.tenant.id, branch_id, label })), { onConflict: "branch_id,label", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error("Masalar eklenemedi.");
  if (tables?.length) {
    await ctx.supabase.from("qr_codes").insert(tables.map((t) => ({ tenant_id: ctx.tenant.id, branch_id, table_id: t.id }))).throwOnError();
  }
  revalidatePath(`/dashboard/${ctx.tenant.slug}/qr`);
}

export async function addBranchQr(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  const branch_id = uuid.parse(form.get("branch_id"));
  await ctx.supabase.from("qr_codes").insert({ tenant_id: ctx.tenant.id, branch_id, table_id: null }).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}/qr`);
}

/** Yenile: eski kod pasifleşir (artık menü açmaz), aynı masa için yeni rastgele kod üretilir. */
export async function regenerateQr(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  const id = uuid.parse(form.get("id"));
  const { data: old } = await ctx.supabase.from("qr_codes").select("branch_id, table_id")
    .eq("id", id).eq("tenant_id", ctx.tenant.id).single().throwOnError();
  await ctx.supabase.from("qr_codes").update({ is_active: false }).eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  await ctx.supabase.from("qr_codes").insert({ tenant_id: ctx.tenant.id, branch_id: old.branch_id, table_id: old.table_id }).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}/qr`);
}

export async function setQrActive(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("qr_codes").update({ is_active: form.get("value") === "true" })
    .eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}/qr`);
}

export async function deleteTable(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("tables").delete().eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  revalidatePath(`/dashboard/${ctx.tenant.slug}/qr`);
}
