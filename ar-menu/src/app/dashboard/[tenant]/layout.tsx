import Link from "next/link";
import { getTenantContext } from "@/lib/tenant-context";
import { SuspendedNotice } from "@/components/suspended-notice";
import { logout } from "@/lib/auth/actions";
import { NavLinks } from "./nav-links";

export const dynamic = "force-dynamic";

export default async function TenantLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return <SuspendedNotice forOwner />;

  const base = `/dashboard/${ctx.tenant.slug}`;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={base} className="font-bold">{ctx.tenant.name}</Link>
          <NavLinks base={base} isOwner={ctx.isOwner} />
          <form action={logout}><button className="btn-ghost px-3 py-1 text-xs">Çıkış</button></form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
