"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./db";
import { audit, requireAdmin } from "./auth";
import { MenuApiError, setTenantStatus } from "./menu-api";

export type ToggleResult = { ok: true; status: "active" | "suspended"; edge: string } | { ok: false; error: string };

const Input = z.object({
  tenantId: z.uuid(),
  tenantSlug: z.string().max(60),
  action: z.enum(["suspend", "activate"]),
  reason: z.string().trim().min(3, "Sebep en az 3 karakter olmalı.").max(500),
});

/**
 * Tek tık aç/kapat. Önce denetim kaydı "pending" yazılır, sonra Sistem 1'e imzalı istek gider,
 * yanıt kayda işlenir. Sistem 1 onaylamadıkça panel durumu değişmiş göstermez.
 */
export async function toggleTenant(raw: z.input<typeof Input>): Promise<ToggleResult> {
  const admin = await requireAdmin();
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  const { tenantId, tenantSlug, action, reason } = parsed.data;

  const requestId = randomUUID();
  await audit({ adminId: admin.id, adminEmail: admin.email, action, tenantId, tenantSlug, reason, requestId, outcome: "pending" });

  try {
    const res = await setTenantStatus(tenantId, action, reason, requestId);
    await db()`update public.audit_log set outcome = 'ok', upstream_status = 200 where request_id = ${requestId}`;
    revalidatePath("/", "layout");
    return { ok: true, status: res.status, edge: res.edge };
  } catch (e) {
    const status = e instanceof MenuApiError ? e.status : 0;
    await db()`update public.audit_log set outcome = 'failed', upstream_status = ${status} where request_id = ${requestId}`;
    return {
      ok: false,
      error: status === 0
        ? "Menü Platformu'na ulaşılamadı. İşlem UYGULANMADI; lütfen tekrar deneyin."
        : `Menü Platformu işlemi reddetti (${status}). İşlem UYGULANMADI.`,
    };
  }
}
