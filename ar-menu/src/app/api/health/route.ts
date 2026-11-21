import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

/**
 * Sağlık kontrolü: uygulama ve veritabanı yanıt veriyor mu?
 * - Dış izleme servisi (ör. UptimeRobot) bu adresi düzenli yoklar; 503 dönerse uyarı gönderir.
 * - Vercel'in günlük görevi de çağırır; böylece ücretsiz Supabase projesi hareketsizlikten duraklatılmaz.
 * Hiçbir işletme verisi döndürmez.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  // Var olamayacak bir slug: fonksiyon veritabanına gidip null döner, hiçbir menü okunmaz.
  const { error } = await createAnonClient().rpc("get_public_menu", { p_tenant_slug: "-", p_branch_slug: "-" });
  const ms = Date.now() - started;
  return NextResponse.json(
    { ok: !error, db: error ? "down" : "ok", ms },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
