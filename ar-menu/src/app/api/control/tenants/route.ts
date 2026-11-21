import { NextResponse, type NextRequest } from "next/server";
import { guardControlRequest } from "@/lib/control/guard";
import { listTenants } from "@/lib/control/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await guardControlRequest(req, "");
  if (denied) return denied;
  try {
    return NextResponse.json({ tenants: await listTenants() });
  } catch (err) {
    console.error("control.list_failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
