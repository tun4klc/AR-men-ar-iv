/**
 * Misafir kilidi: QR ile menüye gelen müşteri, adres çubuğuna başka bir adres yazsa bile
 * (ana sayfa, kayıt vb.) kendi menüsüne geri gönderilir. Bu bir güvenlik sınırı değil,
 * kullanım kısıtıdır; panelin asıl koruması oturum + üyelik kontrolüdür.
 */

export const GUEST_COOKIE = "ar_guest_menu";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 3; // 3 saat: bir restoran ziyareti

const MENU_PATH = /^\/m\/[a-z0-9-]+\/[a-z0-9-]+\/?$/;
const SAVED_MENU = /^\/m\/[a-z0-9-]+\/[a-z0-9-]+\/?(\?[^#\\]*)?$/;

// Misafirin girebileceği yollar. Giriş/panel açık kalır ki işletme sahibi kendi QR'ını
// okuttuktan sonra kilitlenmesin; bu rotalar zaten oturum ister.
const GUEST_ALLOWED = [/^\/m\//, /^\/q\//, /^\/askida\/?$/, /^\/qr-gecersiz\/?$/,
  /^\/login\/?$/, /^\/auth\//, /^\/dashboard(\/|$)/, /^\/onboarding\/?$/, /^\/api\//];

export function isMenuPath(pathname: string): boolean {
  return MENU_PATH.test(pathname);
}

/** Kilit uygulanacaksa misafirin geri gönderileceği menü yolunu, yoksa null döndürür. */
export function guestRedirectTarget(
  pathname: string, savedMenu: string | undefined, hasSession: boolean,
): string | null {
  if (!savedMenu || hasSession) return null;
  if (GUEST_ALLOWED.some((re) => re.test(pathname))) return null;
  if (!SAVED_MENU.test(savedMenu)) return null;
  return savedMenu;
}

export function hasSupabaseSession(cookieNames: string[]): boolean {
  return cookieNames.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));
}
