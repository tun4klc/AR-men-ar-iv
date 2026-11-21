import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "menu-media";

/**
 * İmzalı URL önbelleği (sunucu örneği başına, bellekte).
 * Supabase her imzalamada farklı bir URL üretir; aynı URL'yi bir süre tekrar vermek
 * tarayıcının fotoğrafı önbellekten kullanmasını sağlar ve imzalama isteğini azaltır.
 * URL 60 dakika geçerli, önbellekte 50 dakika tutulur: verilen her URL en az 10 dakika daha çalışır.
 * Bulunamayan dosyalar (örn. küçük kopyası olmayan eski fotoğraflar) kısa süre "yok" olarak hatırlanır.
 */
const URL_TTL_S = 3600;
const KEEP_MS = 50 * 60 * 1000;
const MISS_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;
const cache = new Map<string, { url: string | null; until: number }>();

function remember(path: string, url: string | null, now: number) {
  if (cache.size >= MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  }
  cache.set(path, { url, until: now + (url ? KEEP_MS : MISS_MS) });
}

/** Özel bucket'tan imzalı URL'ler üretir. İşletme askıdaysa storage RLS reddeder (önbelleğe alınmaz). */
export async function signPaths(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
  expiresIn = URL_TTL_S,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const now = Date.now();
  const missing: string[] = [];
  for (const p of unique) {
    const hit = cache.get(p);
    if (hit && hit.until > now) { if (hit.url) out.set(p, hit.url); }
    else missing.push(p);
  }
  if (missing.length === 0) return out;

  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(missing, expiresIn);
  if (error) return out; // toplu hata (askı, ağ): hiçbir şeyi önbelleğe alma
  const cacheable = expiresIn === URL_TTL_S;
  for (const item of data ?? []) {
    if (!item.path) continue;
    if (item.signedUrl) {
      out.set(item.path, item.signedUrl);
      if (cacheable) remember(item.path, item.signedUrl, now);
    } else if (cacheable && item.path.endsWith("-thumb.jpg")) {
      // Yalnızca "küçük kopya yok" bilgisi hatırlanır; erişim reddi (askı) asla önbelleğe alınmaz.
      remember(item.path, null, now);
    }
  }
  return out;
}
