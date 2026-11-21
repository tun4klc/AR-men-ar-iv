import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSuspendedSlugs } from "@/lib/suspension";
import {
  GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, guestRedirectTarget, hasSupabaseSession, isMenuPath,
} from "@/lib/guest-lock";

const TENANT_ROUTE = /^\/(?:m|dashboard)\/([a-z0-9-]+)(?:\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0) Misafir kilidi: menüye QR ile gelen müşteri başka sayfalara geçemez, menüsüne döner.
  const guestTarget = guestRedirectTarget(
    pathname,
    request.cookies.get(GUEST_COOKIE)?.value,
    hasSupabaseSession(request.cookies.getAll().map((c) => c.name)),
  );
  if (guestTarget) {
    const res = NextResponse.redirect(new URL(guestTarget, request.url));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 1) Kill-switch (edge katmanı): askıdaki işletmenin menü ve panel rotaları anında kapanır.
  const match = pathname.match(TENANT_ROUTE);
  if (match) {
    const suspended = await getSuspendedSlugs();
    if (suspended.has(match[1])) {
      const url = request.nextUrl.clone();
      url.pathname = "/askida";
      url.search = "";
      return NextResponse.rewrite(url, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  // 2) Panel rotalarında Supabase oturumunu yenile.
  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/onboarding")) {
    const res = NextResponse.next();
    // Menü açıldığında misafirin menüsünü hatırla (masa numarasıyla birlikte).
    if (isMenuPath(pathname)) {
      res.cookies.set(GUEST_COOKIE, pathname + request.nextUrl.search, {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: GUEST_COOKIE_MAX_AGE,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return res;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Statik dosyalar hariç tüm sayfalar (misafir kilidi her adreste çalışmalı).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
