import { get } from "@vercel/global-config";

/**
 * Kill-switch'in edge katmanı: askıdaki işletme slug'larının listesi.
 * EDGE_CONFIG tanımlı değilse boş döner — veritabanı katmanı yine de veriyi keser.
 */
export async function getSuspendedSlugs(): Promise<Set<string>> {
  if (!process.env.EDGE_CONFIG) return new Set();
  try {
    const list = await get<string[]>("suspended_tenants");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}
