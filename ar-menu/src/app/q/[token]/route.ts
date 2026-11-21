import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// QR girişi: token doğrulanır, qr_scan olayı yazılır, misafir menüye yönlendirilir.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return NextResponse.redirect(new URL("/qr-gecersiz", req.url));
  }

  const { data, error } = await createAnonClient().rpc("resolve_qr", { p_token: token });
  if (error || !data) return NextResponse.redirect(new URL("/qr-gecersiz", req.url));
  if (data.status === "suspended") return NextResponse.redirect(new URL("/askida", req.url));

  const target = new URL(`/m/${data.tenant_slug}/${data.branch_slug}`, req.url);
  if (data.table_label) target.searchParams.set("masa", data.table_label);
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
