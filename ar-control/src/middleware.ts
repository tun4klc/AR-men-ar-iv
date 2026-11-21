import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// /api/health kendi içinde CRON_SECRET ister (oturum çerezi olmayan Vercel görevi çağırır).
const PUBLIC = ["/login", "/robots.txt", "/api/health"];

export async function middleware(req: NextRequest) {
  // İsteğe bağlı IP allowlist: panel yalnızca belirli ağlardan açılır.
  const allowed = (process.env.ADMIN_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length) {
    const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!ip || !allowed.includes(ip)) return new NextResponse("Not found", { status: 404 });
  }

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, "full");
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
