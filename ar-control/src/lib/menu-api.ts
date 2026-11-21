import "server-only";
import { randomUUID } from "node:crypto";
import { signRequest } from "./signature";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  suspended_reason: string | null;
  created_at: string;
  branch_count: number;
  scans_30d: number;
  product_views_30d: number;
  ar_opens_30d: number;
  last_activity_at: string | null;
};

export class MenuApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`Menü Platformu yanıtı: ${status} ${code}`);
  }
}

/** Sistem 1'e imzalı istek. status 0 = ulaşılamadı (ağ hatası / zaman aşımı). */
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const base = process.env.MENU_API_BASE_URL;
  const secret = process.env.CONTROL_HMAC_SECRET;
  if (!base || !secret) throw new MenuApiError(0, "not_configured");

  const raw = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signature = signRequest(secret, { timestamp, nonce, method, path, body: raw });

  let res: Response;
  try {
    res = await fetch(new URL(path, base), {
      method,
      headers: {
        "x-ctl-timestamp": timestamp,
        "x-ctl-nonce": nonce,
        "x-ctl-signature": signature,
        ...(raw ? { "Content-Type": "application/json" } : {}),
      },
      body: raw || undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MenuApiError(0, "unreachable");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new MenuApiError(res.status, String(json?.error ?? "error"));
  return json as T;
}

export async function fetchTenants(): Promise<Tenant[]> {
  const data = await call<{ tenants: Tenant[] }>("GET", "/api/control/tenants");
  return data.tenants;
}

export async function setTenantStatus(
  tenantId: string, action: "suspend" | "activate", reason: string, requestId: string,
): Promise<{ id: string; slug: string; status: "active" | "suspended"; edge: string }> {
  return call("POST", `/api/control/tenants/${encodeURIComponent(tenantId)}/${action}`, { reason, request_id: requestId });
}
