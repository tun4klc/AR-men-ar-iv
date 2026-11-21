import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";

export type TenantContext = Awaited<ReturnType<typeof loadContext>>;

/**
 * Panel için işletme bağlamı. Kapsam URL slug'ı + RLS ile çözülür; istemciden tenant_id alınmaz.
 * Askıdaki işletmede RLS hiçbir satır döndürmez → { suspended: true }.
 */
async function loadContext(slug: string) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${encodeURIComponent(slug)}`);

  const { data: tenant } = await supabase
    .from("tenants").select("id, slug, name, status").eq("slug", slug).maybeSingle();

  if (!tenant) {
    const { data: mine } = await supabase.rpc("my_tenants");
    const entry = (mine as { slug: string; status: string }[] | null)?.find((t) => t.slug === slug);
    if (entry?.status === "suspended") return { suspended: true as const };
    notFound();
  }

  const { data: membership } = await supabase
    .from("memberships").select("role, branch_id")
    .eq("tenant_id", tenant.id).eq("user_id", user.id).single();
  if (!membership) notFound();

  return {
    suspended: false as const,
    supabase,
    user,
    tenant: tenant as { id: string; slug: string; name: string; status: string },
    role: membership.role as "owner" | "manager",
    branchScope: membership.branch_id as string | null,
    canEditCatalog: membership.role === "owner" || membership.branch_id === null,
    isOwner: membership.role === "owner",
  };
}

export const getTenantContext = cache(loadContext);

/** Server action'lar için: askıdaysa veya yetki yoksa hata fırlatır. */
export async function requireActiveTenant(slug: string) {
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) throw new Error("İşletme askıda.");
  return ctx;
}
