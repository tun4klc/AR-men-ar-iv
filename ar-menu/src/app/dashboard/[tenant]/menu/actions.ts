"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveTenant } from "@/lib/tenant-context";
import { ALLERGENS } from "@/lib/format";
import { thumbPath } from "@/lib/media-paths";
import { EXTRA_LANGS, planTranslation, type LangText, type Translations } from "@/lib/menu-i18n";
import { AUTO_LANGS, translateMenuText, translationEnabled, type AutoLang } from "@/lib/translate";

export type ActionState = { error?: string; ok?: string } | undefined;

const uuid = z.uuid();
const ALLERGEN_KEYS = new Set<string>(ALLERGENS.map(([k]) => k));

async function catalogCtx(form: FormData) {
  const ctx = await requireActiveTenant(String(form.get("tenant") ?? ""));
  if (!ctx.canEditCatalog) throw new Error("Bu işlem için yetkiniz yok.");
  return ctx;
}

function done(slug: string) {
  revalidatePath(`/dashboard/${slug}/menu`, "layout");
}

// ---- Çeviri -----------------------------------------------------------
type I18nRow = {
  name_tr: string; description_tr?: string | null; name_en: string | null; description_en?: string | null;
  translations?: Translations | null;
};
type TranslateNote = "done" | "off" | "failed" | null;

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;

/**
 * Kaydedilen Türkçe metne göre İngilizce/Almanca/Rusça/Arapça alanlarını tamamlar.
 * Boş alanlar ve Türkçe değiştiği hâlde dokunulmamış eski çeviriler Claude ile yeniden çevrilir;
 * elle yazılan çeviriler korunur. Çeviri yapılamazsa kayıt yine yapılır (menü Türkçe/İngilizceye döner).
 */
async function withTranslations(
  prev: I18nRow | null, next: I18nRow, submitted: Translations, force: boolean,
): Promise<{ name_en: string | null; description_en: string | null; translations: Translations; note: TranslateNote }> {
  const trChanged = !prev || prev.name_tr !== next.name_tr || (prev.description_tr ?? "") !== (next.description_tr ?? "");
  const hasDescription = !!clean(next.description_tr);
  const current: Record<AutoLang, LangText> = {
    en: { name: next.name_en, description: next.description_en ?? null },
    de: submitted.de ?? {}, ru: submitted.ru ?? {}, ar: submitted.ar ?? {},
  };
  const previous = (l: AutoLang): LangText | undefined => !prev ? undefined
    : l === "en" ? { name: prev.name_en, description: prev.description_en ?? null } : prev.translations?.[l];

  const plans = Object.fromEntries(AUTO_LANGS.map((l) => [l, planTranslation({
    trChanged, hasDescription, previous: previous(l), submitted: current[l], force,
  })])) as Record<AutoLang, { name: boolean; description: boolean }>;
  const needed = AUTO_LANGS.filter((l) => plans[l].name || plans[l].description);

  const result = needed.length
    ? await translateMenuText({ name: next.name_tr, description: clean(next.description_tr) }, needed) : null;

  const final = {} as Record<AutoLang, { name: string | null; description: string | null }>;
  for (const l of AUTO_LANGS) {
    const got = result?.[l];
    final[l] = {
      name: plans[l].name && got ? got.name : clean(current[l].name),
      description: !hasDescription && !clean(current[l].description) ? null
        : plans[l].description && got ? got.description : clean(current[l].description),
    };
  }
  const translations: Translations = {};
  for (const l of EXTRA_LANGS) {
    if (final[l].name || final[l].description) translations[l] = { name: final[l].name, description: final[l].description };
  }
  const note: TranslateNote = !needed.length ? null : !translationEnabled() ? "off" : result ? "done" : "failed";
  return { name_en: final.en.name, description_en: final.en.description, translations, note };
}

function noteText(note: TranslateNote): string {
  if (note === "done") return " Çeviriler güncellendi.";
  if (note === "failed") return " Otomatik çeviri şu an yapılamadı; çevrilmeyen diller Türkçe/İngilizce gösterilir.";
  if (note === "off") return " Otomatik çeviri kapalı: Vercel'de ANTHROPIC_API_KEY tanımlı değil.";
  return "";
}

function readTranslations(form: FormData): Translations {
  const out: Translations = {};
  for (const l of EXTRA_LANGS) {
    const name = z.string().max(120).parse(String(form.get(`name_${l}`) ?? "")).trim();
    const description = z.string().max(1000).parse(String(form.get(`description_${l}`) ?? "")).trim();
    out[l] = { name: name || null, description: description || null };
  }
  return out;
}

// ---- Kategoriler -----------------------------------------------------
export async function addCategory(form: FormData) {
  const ctx = await catalogCtx(form);
  const name = z.string().trim().min(1).max(80).parse(form.get("name_tr"));
  const name_en = z.string().trim().max(80).parse(form.get("name_en") ?? "") || null;
  const { count } = await ctx.supabase.from("categories").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id);
  const t = await withTranslations(null, { name_tr: name, name_en }, {}, false);
  await ctx.supabase.from("categories").insert({
    tenant_id: ctx.tenant.id, name_tr: name, name_en: t.name_en, translations: t.translations, sort_order: count ?? 0,
  }).throwOnError();
  done(ctx.tenant.slug);
}

export async function updateCategory(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  const name = z.string().trim().min(1).max(80).parse(form.get("name_tr"));
  const name_en = z.string().trim().max(80).parse(form.get("name_en") ?? "") || null;
  const { data: prev } = await ctx.supabase.from("categories").select("name_tr, name_en, translations")
    .eq("id", id).eq("tenant_id", ctx.tenant.id).single();
  // Kategori listesinde yalnızca TR/EN alanı var; diğer diller önceki çevirilerden gelir.
  const t = await withTranslations(prev, { name_tr: name, name_en }, prev?.translations ?? {}, false);
  await ctx.supabase.from("categories").update({ name_tr: name, name_en: t.name_en, translations: t.translations })
    .eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  done(ctx.tenant.slug);
}

export async function deleteCategory(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("categories").delete().eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  done(ctx.tenant.slug);
}

/** Yukarı/aşağı taşıma: komşu kayıtla sort_order değiş tokuşu, ardından sıralar normalize edilir. */
async function move(table: "categories" | "products", form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  let q = ctx.supabase.from(table).select("id, sort_order, created_at").eq("tenant_id", ctx.tenant.id);
  if (table === "products") q = q.eq("category_id", uuid.parse(form.get("category_id")));
  const { data } = await q.order("sort_order").order("created_at");
  const rows = data ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await Promise.all(rows.map((r, idx) =>
    ctx.supabase.from(table).update({ sort_order: idx }).eq("id", r.id).eq("tenant_id", ctx.tenant.id).throwOnError()));
  done(ctx.tenant.slug);
}
export async function moveCategory(form: FormData) { await move("categories", form); }
export async function moveProduct(form: FormData) { await move("products", form); }

// ---- Ürünler ----------------------------------------------------------
const ProductSchema = z.object({
  category_id: uuid,
  name_tr: z.string().trim().min(1, "Ürün adı gerekli.").max(120),
  name_en: z.string().trim().max(120).transform((s) => s || null),
  description_tr: z.string().trim().max(1000).transform((s) => s || null),
  description_en: z.string().trim().max(1000).transform((s) => s || null),
  base_price: z.coerce.number({ error: "Geçerli bir fiyat girin." }).min(0).max(1_000_000),
  is_active: z.boolean(),
  allergens: z.array(z.string()).transform((a) => a.filter((x) => ALLERGEN_KEYS.has(x))),
});

function readProduct(form: FormData) {
  return ProductSchema.safeParse({
    category_id: form.get("category_id"),
    name_tr: form.get("name_tr") ?? "",
    name_en: form.get("name_en") ?? "",
    description_tr: form.get("description_tr") ?? "",
    description_en: form.get("description_en") ?? "",
    base_price: String(form.get("base_price") ?? "").replace(",", "."),
    is_active: form.get("is_active") === "on",
    allergens: form.getAll("allergens").map(String),
  });
}

export async function createProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await catalogCtx(form);
  const parsed = readProduct(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { count } = await ctx.supabase.from("products").select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.id).eq("category_id", parsed.data.category_id);
  const t = await withTranslations(null, parsed.data, readTranslations(form), false);
  const { data, error } = await ctx.supabase.from("products")
    .insert({ ...parsed.data, name_en: t.name_en, description_en: t.description_en, translations: t.translations,
      tenant_id: ctx.tenant.id, sort_order: count ?? 0 }).select("id").single();
  if (error) return { error: "Ürün kaydedilemedi." };
  done(ctx.tenant.slug);
  redirect(`/dashboard/${ctx.tenant.slug}/menu/products/${data.id}?yeni=1`);
}

export async function updateProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  const parsed = readProduct(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { data: prev } = await ctx.supabase.from("products")
    .select("name_tr, description_tr, name_en, description_en, translations").eq("id", id).eq("tenant_id", ctx.tenant.id).single();
  const t = await withTranslations(prev, parsed.data, readTranslations(form), form.get("retranslate") === "1");
  const { error } = await ctx.supabase.from("products")
    .update({ ...parsed.data, name_en: t.name_en, description_en: t.description_en, translations: t.translations,
      updated_at: new Date().toISOString() })
    .eq("id", id).eq("tenant_id", ctx.tenant.id);
  if (error) return { error: "Ürün güncellenemedi." };
  done(ctx.tenant.slug);
  return { ok: "Kaydedildi." + noteText(t.note) };
}

export async function quickUpdatePrice(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  const price = z.coerce.number().min(0).max(1_000_000).parse(String(form.get("base_price") ?? "").replace(",", "."));
  await ctx.supabase.from("products").update({ base_price: price }).eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  done(ctx.tenant.slug);
}

export async function toggleProduct(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("products").update({ is_active: form.get("is_active") === "true" })
    .eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  done(ctx.tenant.slug);
}

export async function deleteProduct(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  await ctx.supabase.from("products").delete().eq("id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  await removeFolder(ctx, `${ctx.tenant.id}/products/${id}`);
  done(ctx.tenant.slug);
  redirect(`/dashboard/${ctx.tenant.slug}/menu`);
}

// ---- Medya ------------------------------------------------------------
type Ctx = Awaited<ReturnType<typeof catalogCtx>>;

async function removeFolder(ctx: Ctx, prefix: string) {
  const { data } = await ctx.supabase.storage.from("menu-media").list(prefix, { limit: 100 });
  const paths = (data ?? []).map((f) => `${prefix}/${f.name}`);
  if (paths.length) await ctx.supabase.storage.from("menu-media").remove(paths);
}

/** Yüklenen dosya yolu yalnızca bu işletmenin bu ürün klasöründe ve beklenen uzantıda olabilir. */
function checkPath(ctx: Ctx, productId: string, path: unknown, exts: string[]): string | null {
  if (typeof path !== "string" || path === "") return null;
  const prefix = `${ctx.tenant.id}/products/${productId}/`;
  const ok = path.startsWith(prefix) && !path.includes("..")
    && /^[a-z0-9-]+\.[a-z0-9]+$/.test(path.slice(prefix.length))
    && exts.some((e) => path.endsWith(`.${e}`));
  if (!ok) throw new Error("Geçersiz dosya yolu.");
  return path;
}

/**
 * Ürün görselini kaydeder. Hata fırlatmak yerine sonuç döndürür: üretimde Next.js fırlatılan
 * hataların mesajını gizler ve kullanıcı neyin ters gittiğini göremezdi.
 */
export async function setProductImage(productId: string, tenantSlug: string, path: string | null): Promise<ActionState> {
  try {
    const form = new FormData();
    form.set("tenant", tenantSlug);
    const ctx = await catalogCtx(form);
    const id = uuid.parse(productId);
    const image_path = path ? checkPath(ctx, id, path, ["jpg", "jpeg", "png", "webp"]) : null;
    const { data: old } = await ctx.supabase.from("products").select("image_path").eq("id", id).eq("tenant_id", ctx.tenant.id).single();
    const { data: saved, error } = await ctx.supabase.from("products").update({ image_path })
      .eq("id", id).eq("tenant_id", ctx.tenant.id).select("id");
    if (error || !saved?.length) return { error: "Görsel ürüne kaydedilemedi. Sayfayı yenileyip tekrar deneyin." };
    if (old?.image_path && old.image_path !== image_path) {
      await ctx.supabase.storage.from("menu-media").remove([old.image_path, thumbPath(old.image_path)]);
    }
    done(ctx.tenant.slug);
    return { ok: "Görsel güncellendi." };
  } catch (e) {
    // redirect()/notFound() (oturum düşmüşse) Next.js'e aynen iletilmeli.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    return { error: e instanceof Error && e.message ? e.message : "Görsel kaydedilemedi." };
  }
}

const ModelSchema = z.object({
  width_cm: z.coerce.number().positive().max(200),
  depth_cm: z.coerce.number().positive().max(200),
  height_cm: z.coerce.number().positive().max(200),
});

export async function saveProductModel(
  tenantSlug: string, productId: string,
  input: { glb_path: string; usdz_path: string | null; poster_path: string | null; width_cm: number; depth_cm: number; height_cm: number },
): Promise<ActionState> {
  const form = new FormData();
  form.set("tenant", tenantSlug);
  const ctx = await catalogCtx(form);
  const id = uuid.parse(productId);
  const dims = ModelSchema.safeParse(input);
  if (!dims.success) return { error: "Gerçek boyutlar 0–200 cm arasında olmalı." };
  try {
    const row = {
      product_id: id,
      tenant_id: ctx.tenant.id,
      glb_path: checkPath(ctx, id, input.glb_path, ["glb"])!,
      usdz_path: checkPath(ctx, id, input.usdz_path, ["usdz"]),
      poster_path: checkPath(ctx, id, input.poster_path, ["jpg", "jpeg", "png", "webp"]),
      ...dims.data,
    };
    if (!row.glb_path) return { error: "GLB dosyası gerekli." };
    const { data: old } = await ctx.supabase.from("product_models").select("glb_path, usdz_path, poster_path").eq("product_id", id).maybeSingle();
    const { error } = await ctx.supabase.from("product_models").upsert(row);
    if (error) return { error: "3D model kaydedilemedi." };
    const stale = [old?.glb_path, old?.usdz_path, old?.poster_path]
      .filter((p): p is string => !!p && ![row.glb_path, row.usdz_path, row.poster_path].includes(p));
    if (stale.length) await ctx.supabase.storage.from("menu-media").remove(stale);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kaydedilemedi." };
  }
  done(ctx.tenant.slug);
  return { ok: "3D model kaydedildi." };
}

export async function deleteProductModel(form: FormData) {
  const ctx = await catalogCtx(form);
  const id = uuid.parse(form.get("id"));
  const { data: old } = await ctx.supabase.from("product_models").select("glb_path, usdz_path, poster_path").eq("product_id", id).maybeSingle();
  await ctx.supabase.from("product_models").delete().eq("product_id", id).eq("tenant_id", ctx.tenant.id).throwOnError();
  const paths = [old?.glb_path, old?.usdz_path, old?.poster_path].filter((p): p is string => !!p);
  if (paths.length) await ctx.supabase.storage.from("menu-media").remove(paths);
  done(ctx.tenant.slug);
}
