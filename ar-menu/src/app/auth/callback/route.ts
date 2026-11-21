import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
