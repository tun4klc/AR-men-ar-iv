"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Stats = {
  totals: { qr_scans: number; menu_views: number; product_views: number; ar_opens: number; ar_placed: number; sessions: number };
  top_products: { id: string; name: string; product_views: number; ar_opens: number; ar_placed: number }[];
  by_branch: { id: string; name: string; qr_scans: number; product_views: number; ar_opens: number }[];
  daily: { day: string; qr_scans: number; product_views: number; ar_opens: number }[];
};

const C = { views: "#c2410c", ar: "#0f766e", scans: "#57534e" };
const nf = new Intl.NumberFormat("tr-TR");
const pct = (a: number, b: number) => (b > 0 ? `%${Math.round((a / b) * 100)}` : "—");

export function StatsCharts({ stats, showBranches }: { stats: Stats; showBranches: boolean }) {
  const t = stats.totals;
  const tiles = [
    { label: "QR tarama", value: t.qr_scans },
    { label: "Ziyaretçi oturumu", value: t.sessions },
    { label: "Ürün görüntüleme", value: t.product_views },
    { label: "AR açılma", value: t.ar_opens, sub: `Görüntülemelerin ${pct(t.ar_opens, t.product_views)}'i` },
  ];
  const top = stats.top_products.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="card">
            <p className="text-xs text-muted">{x.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{nf.format(x.value)}</p>
            {x.sub && <p className="text-xs text-muted">{x.sub}</p>}
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold">En çok ilgi gören ürünler</h2>
        <p className="mb-4 text-xs text-muted">Ürün detayına giriş ve AR açılma sayısı</p>
        {top.length === 0 ? <Empty /> : (
          <>
            <div style={{ height: Math.max(220, top.length * 36) }}>
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="product_views" name="Görüntüleme" fill={C.views} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="ar_opens" name="AR açılma" fill={C.ar} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1">#</th><th>Ürün</th><th className="text-right">Görüntüleme</th><th className="text-right">AR</th><th className="text-right">AR oranı</th></tr>
              </thead>
              <tbody>
                {stats.top_products.map((p, i) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-1.5 text-muted">{i + 1}</td><td>{p.name}</td>
                    <td className="text-right tabular-nums">{nf.format(p.product_views)}</td>
                    <td className="text-right tabular-nums">{nf.format(p.ar_opens)}</td>
                    <td className="text-right tabular-nums">{pct(p.ar_opens, p.product_views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {showBranches && (
        <section className="card">
          <h2 className="mb-4 font-semibold">Şube karşılaştırması</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={stats.by_branch}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip /><Legend />
                <Bar dataKey="qr_scans" name="QR tarama" fill={C.scans} />
                <Bar dataKey="product_views" name="Görüntüleme" fill={C.views} />
                <Bar dataKey="ar_opens" name="AR açılma" fill={C.ar} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-4 font-semibold">Günlük eğilim</h2>
        {stats.daily.length === 0 ? <Empty /> : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={stats.daily}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip /><Legend />
                <Line dataKey="qr_scans" name="QR tarama" stroke={C.scans} dot={false} strokeWidth={2} />
                <Line dataKey="product_views" name="Görüntüleme" stroke={C.views} dot={false} strokeWidth={2} />
                <Line dataKey="ar_opens" name="AR açılma" stroke={C.ar} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted">Bu dönem için henüz veri yok. Misafirler QR kodu okuttukça burada görünecek.</p>;
}
