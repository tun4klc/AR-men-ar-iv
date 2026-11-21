import "server-only";

/**
 * Kill-switch'in edge katmanını günceller: askıdaki slug listesini Vercel Edge/Global Config'e yazar.
 * Middleware bu listeyi milisaniyeler içinde okur. Ayarlı değilse (yerel geliştirme) atlanır;
 * veritabanı katmanı yine de veriyi keser.
 */
export async function syncSuspendedSlugs(slugs: string[]): Promise<"synced" | "skipped" | "failed"> {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) return "skipped";

  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  try {
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${encodeURIComponent(id)}/items${team}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: "suspended_tenants", value: slugs }] }),
      cache: "no-store",
    });
    return res.ok ? "synced" : "failed";
  } catch {
    return "failed";
  }
}
