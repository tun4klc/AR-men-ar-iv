"use client";

type EventType = "menu_view" | "product_view" | "ar_open" | "ar_placed";

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem("arm_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("arm_sid", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Ziyaretçi olayını record_event RPC'sine gönderir; başarısızlık menüyü asla etkilemez. */
export function track(branchId: string, type: EventType, productId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    void fetch(`${url}/rest/v1/rpc/record_event`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_branch_id: branchId,
        p_type: type,
        p_product_id: productId ?? null,
        p_session_id: sessionId(),
      }),
    }).catch(() => {});
  } catch {
    /* yok say */
  }
}
