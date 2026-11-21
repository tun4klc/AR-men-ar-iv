/** Menünün desteklediği diller. Türkçe kaynak dildir; diğerleri panelde otomatik çevrilir. */
export const MENU_LANGS = ["tr", "en", "de", "ru", "ar"] as const;
export type MenuLang = (typeof MENU_LANGS)[number];
/** Ayrı JSON alanında tutulan diller (İngilizce kendi sütunlarında). */
export const EXTRA_LANGS = ["de", "ru", "ar"] as const;
export type ExtraLang = (typeof EXTRA_LANGS)[number];

export const LANG_LABEL: Record<MenuLang, string> = {
  tr: "Türkçe", en: "English", de: "Deutsch", ru: "Русский", ar: "العربية",
};
export const LANG_LABEL_TR: Record<MenuLang, string> = {
  tr: "Türkçe", en: "İngilizce", de: "Almanca", ru: "Rusça", ar: "Arapça",
};
export const RTL_LANGS: ReadonlySet<MenuLang> = new Set(["ar"]);

export type LangText = { name?: string | null; description?: string | null };
export type Translations = Partial<Record<ExtraLang, LangText>>;

export function isMenuLang(v: unknown): v is MenuLang {
  return typeof v === "string" && (MENU_LANGS as readonly string[]).includes(v);
}

/**
 * Accept-Language başlığından veya navigator.languages listesinden menü dilini seçer.
 * Desteklenmeyen dillerde İngilizce, hiç bilgi yoksa Türkçe.
 */
export function pickLang(preferred: readonly string[]): MenuLang {
  for (const raw of preferred) {
    const base = raw.trim().toLowerCase().split(/[-_;]/)[0];
    if (isMenuLang(base)) return base;
  }
  return preferred.length ? "en" : "tr";
}

/** "tr-TR,tr;q=0.9,en;q=0.8" → ["tr-TR","tr","en"] (q sırasına göre). */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header.split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}

/**
 * Hangi alanların Türkçeden (yeniden) çevrileceğine karar verir.
 *  - Alan boşsa çevrilir.
 *  - Türkçe metin değiştiyse ve kullanıcı o alana bu kayıtta dokunmadıysa çevrilir (eski çeviri bayatlamasın).
 *  - Kullanıcının elle yazdığı/değiştirdiği çeviri korunur.
 *  - force: hepsini yeniden çevir.
 * Açıklama için Türkçe kaynak boşsa çeviri gerekmez (boş kalır).
 */
export function planTranslation(args: {
  trChanged: boolean;
  hasDescription: boolean;
  previous?: LangText;
  submitted: LangText;
  force?: boolean;
}): { name: boolean; description: boolean } {
  const { trChanged, hasDescription, previous, submitted, force } = args;
  const need = (field: "name" | "description") => {
    const now = (submitted[field] ?? "").trim();
    const before = (previous?.[field] ?? "").trim();
    if (force) return true;
    if (!now) return true;
    return trChanged && now === before;
  };
  return { name: need("name"), description: hasDescription && need("description") };
}

/** Ürün/kategori için seçilen dildeki metin; yoksa İngilizce, o da yoksa Türkçe. */
export function localized(
  item: { name_tr: string; name_en?: string | null; description_tr?: string | null; description_en?: string | null; translations?: Translations | null },
  lang: MenuLang,
): { name: string; description: string | null } {
  const enName = item.name_en?.trim() || null;
  const enDesc = item.description_en?.trim() || null;
  if (lang === "tr") return { name: item.name_tr, description: item.description_tr ?? null };
  if (lang === "en") return { name: enName ?? item.name_tr, description: enDesc ?? item.description_tr ?? null };
  const t = item.translations?.[lang];
  return {
    name: t?.name?.trim() || enName || item.name_tr,
    description: t?.description?.trim() || enDesc || item.description_tr || null,
  };
}
