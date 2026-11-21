import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Supabase'e giden her sunucu isteğine süre sınırı: veritabanı yavaşlarsa sayfa sonsuza kadar
 * beklemez, hata ekranı ("tekrar dene") gösterilir. Çağıranın kendi iptal sinyali de korunur.
 */
export const DB_TIMEOUT_MS = 8_000;
export const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(DB_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/** Oturum açmış kullanıcı adına çalışan istemci (RLS kullanıcının yetkisiyle uygulanır). */
export async function createUserClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component içinden çağrıldığında yazılamaz; middleware oturumu yeniler.
        }
      },
    },
  });
}

/** Misafir (anon) istemcisi: çerez taşımaz, yalnızca public RPC'leri çağırır. */
export function createAnonClient() {
  return createClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
