import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createAnonClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import { thumbPath } from "@/lib/media-paths";
import { parseAcceptLanguage, pickLang, type Translations } from "@/lib/menu-i18n";
import { SuspendedNotice } from "@/components/suspended-notice";
import { MenuView } from "@/components/menu/menu-view";
import type { MenuData } from "@/components/menu/types";

export const dynamic = "force-dynamic";

// Telefonun üst çubuğu menünün koyu kavrulmuş rengine uysun.
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d120c" };

type Params = { tenant: string; branch: string };

type RawProduct = {
  id: string; category_id: string; name_tr: string; name_en: string | null;
  description_tr: string | null; description_en: string | null; image_path: string | null;
  allergens: string[]; price: number; is_available: boolean; translations?: Translations | null;
  model: null | { glb_path: string; usdz_path: string | null; poster_path: string | null;
    width_cm: number; depth_cm: number; height_cm: number };
};

// cache(): generateMetadata ve sayfa aynı istekte tek RPC çağrısını paylaşır (ilkel argümanlar şart).
const loadMenu = cache(async function loadMenu(tenant: string, branch: string) {
  const supabase = createAnonClient();
  const call = () => supabase.rpc("get_public_menu", { p_tenant_slug: tenant, p_branch_slug: branch });
  let { data, error } = await call();
  if (error) {
    // Geçici aksaklıkta (ağ, zaman aşımı) bir kez daha dene.
    await new Promise((r) => setTimeout(r, 300));
    ({ data, error } = await call());
  }
  // Veritabanına ulaşılamadıysa "menü bulunamadı" demek yanlış olur: hata ekranı (tekrar dene) gösterilir.
  if (error) throw new Error("Menü şu an yüklenemedi.");
  if (!data) return null;
  if (data.status === "suspended") return { suspended: true as const };

  const products = data.products as RawProduct[];
  const urls = await signPaths(supabase, products.flatMap((p) => [
    p.image_path, p.image_path ? thumbPath(p.image_path) : null, p.model?.glb_path, p.model?.usdz_path, p.model?.poster_path,
  ]));

  const menu: MenuData = {
    tenant: data.tenant,
    branch: data.branch,
    categories: (data.categories as { id: string; name_tr: string; name_en: string | null; translations?: Translations | null }[])
      .map((c) => ({ ...c, translations: c.translations ?? {} })),
    products: products.map((p) => ({
      id: p.id, category_id: p.category_id, name_tr: p.name_tr, name_en: p.name_en,
      description_tr: p.description_tr, description_en: p.description_en,
      image_url: p.image_path ? urls.get(p.image_path) ?? null : null,
      thumb_url: p.image_path ? urls.get(thumbPath(p.image_path)) ?? urls.get(p.image_path) ?? null : null,
      allergens: p.allergens, price: Number(p.price), is_available: p.is_available, translations: p.translations ?? {},
      model: p.model && urls.get(p.model.glb_path) ? {
        glb_url: urls.get(p.model.glb_path)!,
        usdz_url: p.model.usdz_path ? urls.get(p.model.usdz_path) ?? null : null,
        poster_url: p.model.poster_path ? urls.get(p.model.poster_path) ?? null : null,
        width_cm: Number(p.model.width_cm), depth_cm: Number(p.model.depth_cm), height_cm: Number(p.model.height_cm),
      } : null,
    })),
  };
  return { suspended: false as const, menu };
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tenant, branch } = await params;
  const result = await loadMenu(tenant, branch).catch(() => null); // hata sayfanın kendisinde ele alınır
  if (!result || result.suspended) return { title: "Menü", robots: { index: false } };
  return { title: `${result.menu.tenant.name} — ${result.menu.branch.name}`, robots: { index: false } };
}

export default async function MenuPage({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<{ masa?: string }> }) {
  const [p, sp, h] = await Promise.all([params, searchParams, headers()]);
  // Telefonun dili ilk çizimde uygulanır (yanıp sönme olmaz); misafirin seçimi tarayıcıda hatırlanır.
  const initialLang = pickLang(parseAcceptLanguage(h.get("accept-language")));
  const result = await loadMenu(p.tenant, p.branch);
  if (!result) notFound();
  if (result.suspended) return <SuspendedNotice />;
  return <MenuView menu={result.menu} table={sp.masa?.slice(0, 40) ?? null} initialLang={initialLang} />;
}
