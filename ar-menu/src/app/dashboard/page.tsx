import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardIndex() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("my_tenants");
  const tenants = (data ?? []) as { slug: string; name: string; status: string }[];
  if (tenants.length === 0) redirect("/onboarding");
  if (tenants.length === 1) redirect(`/dashboard/${tenants[0].slug}`);
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold">İşletme seçin</h1>
      <ul className="flex flex-col gap-2">
        {tenants.map((t) => (
          <li key={t.slug}><Link href={`/dashboard/${t.slug}`} className="card flex justify-between">
            <span className="font-medium">{t.name}</span>
            {t.status === "suspended" && <span className="text-xs text-warn">Askıda</span>}
          </Link></li>
        ))}
      </ul>
    </main>
  );
}
