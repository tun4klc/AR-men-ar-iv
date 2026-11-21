import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Günlük görevin çağırdığı sağlık kontrolü: veritabanını yoklar, böylece ücretsiz Supabase
 * projesi hareketsizlikten duraklatılmaz. Panel gizli kalsın diye yalnızca Vercel görevinin
 * gönderdiği CRON_SECRET ile yanıt verir; diğer herkese 404.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }
  const started = Date.now();
  try {
    await db()`select 1`;
    return NextResponse.json({ ok: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
