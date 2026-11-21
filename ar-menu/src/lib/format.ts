const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });

export function formatPrice(value: number | string): string {
  return TRY.format(Number(value));
}

export function slugify(input: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const ALLERGENS = [
  ["gluten", "Gluten"], ["milk", "Süt"], ["egg", "Yumurta"], ["nuts", "Kuruyemiş"],
  ["peanut", "Yer fıstığı"], ["soy", "Soya"], ["fish", "Balık"], ["shellfish", "Kabuklu deniz ürünü"],
  ["sesame", "Susam"], ["celery", "Kereviz"], ["mustard", "Hardal"], ["sulphites", "Sülfit"],
] as const;
