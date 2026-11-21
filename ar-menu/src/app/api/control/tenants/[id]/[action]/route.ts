import { NextResponse, after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { guardControlRequest } from "@/lib/control/guard";
import {
  claimSuspensionNotice, releaseSuspensionNotice, setTenantStatus, suspendedSlugs,
} from "@/lib/control/db";
import { syncSuspendedSlugs } from "@/lib/control/edge-sync";
import { suspensionEmail } from "@/lib/control/suspension-email";
import { sendMail } from "@/lib/mail";

/** Askı komutu başına en fazla bir e-posta; gönderilemezse talep geri bırakılır, tekrar denenebilir. */
async function notifySuspension(requestId: string) {
  try {
    const notice = await claimSuspensionNotice(requestId);
    if (!notice) return;
    if (notice.emails.length === 0) {
      console.warn("control.suspension_notice_no_recipient", requestId);
      return;
    }
    const content = suspensionEmail({
      tenantName: notice.tenantName, reason: notice.reason, supportEmail: process.env.SUPPORT_EMAIL,
    });
    const result = await sendMail({ to: notice.emails, ...content });
    if (result !== "sent") {
      await releaseSuspensionNotice(requestId);
      if (result === "skipped") console.warn("control.suspension_notice_skipped: RESEND_API_KEY / MAIL_FROM tanımlı değil");
    }
  } catch (err) {
    console.error("control.suspension_notice_failed", err);
    await releaseSuspensionNotice(requestId).catch(() => {});
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  reason: z.string().trim().min(3).max(500),
  request_id: z.uuid(),
});

const ACTIONS = { suspend: "suspended", activate: "active" } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const raw = await req.text();
  const denied = await guardControlRequest(req, raw);
  if (denied) return denied;

  const { id, action } = await ctx.params;
  const status = ACTIONS[action as keyof typeof ACTIONS];
  if (!status || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const result = await setTenantStatus(id, status, parsed.data.reason, parsed.data.request_id);

    // Edge katmanı + Next önbelleği: etkiyi saniyeler içinde görünür kıl.
    const edge = await syncSuspendedSlugs(await suspendedSlugs());
    revalidateTag(`tenant:${result.slug}`);

    // Askıya alındıysa işletme sahiplerine e-posta: yanıt beklemez, kontrol paneli gecikmez.
    if (result.status === "suspended") {
      const requestId = parsed.data.request_id;
      after(() => notifySuspension(requestId));
    }

    return NextResponse.json({ ...result, edge });
  } catch (err) {
    if (err instanceof Error && /tenant_not_found/.test(err.message)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("control.set_status_failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
