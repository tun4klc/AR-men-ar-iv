"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Tenant } from "@/lib/menu-api";
import { StatusToggle } from "./status-toggle";

type SortKey = "name" | "branch_count" | "scans_30d" | "product_views_30d" | "ar_opens_30d" | "last_activity_at" | "created_at" | "status";

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "İşletme" },
  { key: "branch_count", label: "Şube", num: true },
  { key: "scans_30d", label: "QR (30g)", num: true },
  { key: "product_views_30d", label: "Görüntüleme (30g)", num: true },
  { key: "ar_opens_30d", label: "AR (30g)", num: true },
  { key: "last_activity_at", label: "Son aktivite" },
  { key: "created_at", label: "Kayıt" },
  { key: "status", label: "Durum" },
];

const nf = new Intl.NumberFormat("tr-TR");
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");

export function TenantTable({ tenants, live }: { tenants: Tenant[]; live: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "scans_30d", dir: -1 });

  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    return tenants
      .filter((t) => filter === "all" || t.status === filter)
      .filter((t) => !needle || t.name.toLocaleLowerCase("tr-TR").includes(needle) || t.slug.includes(needle))
      .sort((a, b) => {
        const x = a[sort.key] ?? "", y = b[sort.key] ?? "";
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [tenants, q, filter, sort]);

  const counts = { all: tenants.length, active: tenants.filter((t) => t.status === "active").length, suspended: tenants.filter((t) => t.status === "suspended").length };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İşletme ara" className="input max-w-xs" aria-label="İşletme ara" />
        <div className="flex gap-1 rounded-lg border border-line p-1 text-sm">
          {(["all", "active", "suspended"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 ${filter === f ? "bg-white/10 text-ink" : "text-muted"}`}>
              {f === "all" ? "Tümü" : f === "active" ? "Aktif" : "Askıda"} ({counts[f]})
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-card text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">#</th>
              {COLS.map((c) => (
                <th key={c.key} className={`px-3 py-2 ${c.num ? "text-right" : ""}`}>
                  <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : -1 }))}
                    className="hover:text-ink">
                    {c.label}{sort.key === c.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.id} className={`border-t border-line ${t.status === "suspended" ? "bg-danger/5" : ""}`}>
                <td className="px-3 py-2 text-muted">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/tenants/${t.id}`} className="font-medium hover:text-brand">{t.name}</Link>
                  <div className="text-xs text-muted">{t.slug}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t.branch_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(t.scans_30d)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(t.product_views_30d)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(t.ar_opens_30d)}</td>
                <td className="px-3 py-2">{date(t.last_activity_at)}</td>
                <td className="px-3 py-2">{date(t.created_at)}</td>
                <td className="px-3 py-2"><StatusToggle tenant={t} disabled={!live} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
