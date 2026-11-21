/** Açık yönlendirme koruması: yalnızca site içi mutlak yollar. */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
