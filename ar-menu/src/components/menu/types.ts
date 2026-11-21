export type MenuModel = {
  glb_url: string;
  usdz_url: string | null;
  poster_url: string | null;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
};

import type { MenuLang, Translations } from "@/lib/menu-i18n";

export type MenuProduct = {
  id: string;
  category_id: string;
  name_tr: string;
  name_en: string | null;
  description_tr: string | null;
  description_en: string | null;
  image_url: string | null;
  /** Liste için küçük kopya; yoksa büyük fotoğraf. */
  thumb_url: string | null;
  allergens: string[];
  translations: Translations;
  price: number;
  is_available: boolean;
  model: MenuModel | null;
};

export type MenuCategory = { id: string; name_tr: string; name_en: string | null; translations: Translations };
export type { MenuLang };

export type MenuData = {
  tenant: { name: string; slug: string };
  branch: { id: string; name: string; slug: string };
  categories: MenuCategory[];
  products: MenuProduct[];
};
