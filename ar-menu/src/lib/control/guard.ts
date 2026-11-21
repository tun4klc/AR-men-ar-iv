import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRequest } from "./signature";
import { consumeNonce } from "./db";

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** İmza + zaman + tek kullanımlık nonce + (isteğe bağlı) IP allowlist. Başarısızsa 401/403 yanıtı döner. */
export async function guardControlRequest(req: NextRequest, body: string): Promise<NextResponse | null> {
  const allowed = (process.env.CONTROL_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0) {
    const ip = clientIp(req);
    if (!ip || !allowed.includes(ip)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = verifyRequest(process.env.CONTROL_HMAC_SECRET ?? "", {
    method: req.method,
    path: req.nextUrl.pathname,
    body,
    timestamp: req.headers.get("x-ctl-timestamp"),
    nonce: req.headers.get("x-ctl-nonce"),
    signature: req.headers.get("x-ctl-signature"),
  });
  if (!result.ok) {
    const status = result.reason === "server_misconfigured" ? 503 : 401;
    return NextResponse.json({ error: result.reason }, { status });
  }
  if (!(await consumeNonce(result.nonce))) {
    return NextResponse.json({ error: "replayed" }, { status: 401 });
  }
  return null;
}
