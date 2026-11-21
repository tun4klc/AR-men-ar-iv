import Link from "next/link";
import { getTenantContext } from "@/lib/tenant-context";
import { StatsCharts, type Stats } from "./stats-charts";

export const dynamic = "force-dynamic";

const RANGES = { "7": 7, "30": 30, "90": 90 } as const;

export default async function AnalyticsPage({
  params, searchParams,
}: { params: Promise<{ tenant: string }>; searchParams: Promise<{ sube?: string; gun?: string }> }) {
  const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getTenantContext(slug);
  if (ctx.suspended) return null;

  const days = RANGES[(sp.gun ?? "30") as keyof typeof RANGES] ?? 30;
  const { data: branches } = await ctx.supabase
    .from("branches").select("id, name").eq("tenant_id", ctx.tenant.id).order("created_at");
  const branchList = branches ?? [];
  const branchId = branchList.some((b) => b.id === sp.sube) ? sp.sube! : null;

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const { data, error } = await ctx.supabase.rpc("dashboard_stats", {
    p_tenant_id: ctx.tenant.id, p_from: from.toISOString(), p_to: to.toISOString(), p_branch_id: branchId,
  });

  const base = `/dashboard/${ctx.tenant.slug}`;
  const href = (o: { sube?: string | null; gun?: number }) => {
    const q = new URLSearchParams();
    const s = o.sube === undefined ? branchId : o.sube;
    if (s) q.set("sube", s);
    q.set("gun", String(o.gun ?? days));
    return `${base}?${q}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analitik</h1>
          <p className="text-sm text-muted">Misafirlerin hangi ürünlere girdiği ve AR&apos;ı ne kadar kullandığı.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {branchList.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-card p-1">
              <Pill href={href({ sube: null })} active={!branchId}>Tüm şubeler</Pill>
              {branchList.map((b) => <Pill key={b.id} href={href({ sube: b.id })} active={branchId === b.id}>{b.name}</Pill>)}
            </div>
          )}
          <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
            {Object.values(RANGES).map((d) => <Pill key={d} href={href({ gun: d })} active={days === d}>{d} gün</Pill>)}
          </div>
        </div>
      </div>
      {error || !data ? (
        <p className="card text-danger">İstatistikler yüklenemedi.</p>
      ) : (
        <StatsCharts stats={data as Stats} showBranches={!branchId && branchList.length > 1} />
      )}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`rounded-md px-3 py-1 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper"}`}>{children}</Link>;
}
