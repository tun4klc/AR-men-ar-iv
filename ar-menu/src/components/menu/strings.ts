import type { MenuLang } from "@/lib/menu-i18n";

/** Misafir menüsünün arayüz metinleri (ürün içerikleri panelde çevrilir). */
export type MenuStrings = {
  search: string; table: string; ar: string; soldOut: string; allergens: string; close: string;
  empty: string; browse: string; welcome: string; clear: string; categories: string; language: string;
  items: (n: number) => string;
  arPlace: string; arSize: string; arLoading: string; arFailed: string; arUnsupported: string;
};

export const STRINGS: Record<MenuLang, MenuStrings> = {
  tr: {
    search: "Menüde ara", table: "Masa", ar: "Masamda gör", soldOut: "Tükendi", allergens: "Alerjenler",
    close: "Kapat", empty: "Aramanızla eşleşen ürün yok.", browse: "Menüye göz at", welcome: "Hoş geldiniz",
    clear: "Aramayı temizle", categories: "Kategoriler", language: "Dil", items: (n) => `${n} ürün`,
    arPlace: "Masama yerleştir", arSize: "Gerçek boyut", arLoading: "3D model hazırlanıyor…",
    arFailed: "3D model yüklenemedi. Lütfen daha sonra tekrar deneyin.",
    arUnsupported: "Bu cihaz AR desteklemiyor. Modeli parmağınızla döndürerek inceleyebilirsiniz.",
  },
  en: {
    search: "Search the menu", table: "Table", ar: "See it on my table", soldOut: "Sold out", allergens: "Allergens",
    close: "Close", empty: "No items match your search.", browse: "Browse the menu", welcome: "Welcome",
    clear: "Clear search", categories: "Categories", language: "Language",
    items: (n) => `${n} ${n === 1 ? "item" : "items"}`,
    arPlace: "Place on my table", arSize: "Real size", arLoading: "Preparing the 3D model…",
    arFailed: "The 3D model couldn't be loaded. Please try again later.",
    arUnsupported: "This device doesn't support AR. Turn the model with your finger to look around it.",
  },
  de: {
    search: "Speisekarte durchsuchen", table: "Tisch", ar: "Auf meinem Tisch ansehen", soldOut: "Ausverkauft",
    allergens: "Allergene", close: "Schließen", empty: "Keine Gerichte passen zu Ihrer Suche.",
    browse: "Zur Speisekarte", welcome: "Willkommen", clear: "Suche löschen", categories: "Kategorien",
    language: "Sprache", items: (n) => `${n} ${n === 1 ? "Gericht" : "Gerichte"}`,
    arPlace: "Auf meinen Tisch stellen", arSize: "Echte Größe", arLoading: "3D-Modell wird vorbereitet…",
    arFailed: "Das 3D-Modell konnte nicht geladen werden. Bitte versuchen Sie es später erneut.",
    arUnsupported: "Dieses Gerät unterstützt kein AR. Drehen Sie das Modell mit dem Finger, um es anzusehen.",
  },
  ru: {
    search: "Поиск по меню", table: "Стол", ar: "Посмотреть на столе", soldOut: "Нет в наличии",
    allergens: "Аллергены", close: "Закрыть", empty: "По вашему запросу ничего не найдено.",
    browse: "Открыть меню", welcome: "Добро пожаловать", clear: "Очистить поиск", categories: "Категории",
    language: "Язык",
    items: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? "блюдо" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "блюда" : "блюд";
      return `${n} ${w}`;
    },
    arPlace: "Поставить на мой стол", arSize: "Реальный размер", arLoading: "Загружаем 3D-модель…",
    arFailed: "Не удалось загрузить 3D-модель. Попробуйте позже.",
    arUnsupported: "Это устройство не поддерживает AR. Поворачивайте модель пальцем, чтобы рассмотреть её.",
  },
  ar: {
    search: "ابحث في القائمة", table: "الطاولة", ar: "شاهده على طاولتي", soldOut: "نفد", allergens: "مسببات الحساسية",
    close: "إغلاق", empty: "لا توجد أطباق تطابق بحثك.", browse: "تصفح القائمة", welcome: "أهلاً وسهلاً",
    clear: "مسح البحث", categories: "الفئات", language: "اللغة",
    items: (n) => (n === 1 ? "طبق واحد" : n === 2 ? "طبقان" : n <= 10 ? `${n} أطباق` : `${n} طبقًا`),
    arPlace: "ضعه على طاولتي", arSize: "الحجم الحقيقي", arLoading: "جارٍ تجهيز النموذج ثلاثي الأبعاد…",
    arFailed: "تعذّر تحميل النموذج ثلاثي الأبعاد. يرجى المحاولة لاحقًا.",
    arUnsupported: "هذا الجهاز لا يدعم الواقع المعزز. أدر النموذج بإصبعك لمشاهدته.",
  },
};

/** Alerjen adları (anahtarlar lib/format ALLERGENS ile aynı). */
export const ALLERGEN_LABELS: Record<MenuLang, Record<string, string>> = {
  tr: { gluten: "Gluten", milk: "Süt", egg: "Yumurta", nuts: "Kuruyemiş", peanut: "Yer fıstığı", soy: "Soya",
        fish: "Balık", shellfish: "Kabuklu deniz ürünü", sesame: "Susam", celery: "Kereviz", mustard: "Hardal", sulphites: "Sülfit" },
  en: { gluten: "Gluten", milk: "Milk", egg: "Egg", nuts: "Tree nuts", peanut: "Peanuts", soy: "Soy",
        fish: "Fish", shellfish: "Shellfish", sesame: "Sesame", celery: "Celery", mustard: "Mustard", sulphites: "Sulphites" },
  de: { gluten: "Gluten", milk: "Milch", egg: "Ei", nuts: "Schalenfrüchte", peanut: "Erdnüsse", soy: "Soja",
        fish: "Fisch", shellfish: "Krebstiere", sesame: "Sesam", celery: "Sellerie", mustard: "Senf", sulphites: "Sulfite" },
  ru: { gluten: "Глютен", milk: "Молоко", egg: "Яйца", nuts: "Орехи", peanut: "Арахис", soy: "Соя",
        fish: "Рыба", shellfish: "Ракообразные", sesame: "Кунжут", celery: "Сельдерей", mustard: "Горчица", sulphites: "Сульфиты" },
  ar: { gluten: "الغلوتين", milk: "الحليب", egg: "البيض", nuts: "المكسرات", peanut: "الفول السوداني", soy: "الصويا",
        fish: "السمك", shellfish: "القشريات", sesame: "السمسم", celery: "الكرفس", mustard: "الخردل", sulphites: "الكبريتيت" },
};

const PRICE_LOCALE: Record<MenuLang, string> = { tr: "tr-TR", en: "en-GB", de: "de-DE", ru: "ru-RU", ar: "ar-u-nu-latn" };
const priceFormats = new Map<MenuLang, Intl.NumberFormat>();
/** Fiyat her dilde Türk lirası; yalnızca yazım biçimi dile göre değişir. */
export function formatMenuPrice(value: number, lang: MenuLang): string {
  let f = priceFormats.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(PRICE_LOCALE[lang], { style: "currency", currency: "TRY", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 });
    priceFormats.set(lang, f);
  }
  return f.format(value);
}

export const LANG_STORAGE_KEY = "arm_lang";
