"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ base, isOwner }: { base: string; isOwner: boolean }) {
  const path = usePathname();
  const links = [
    { href: base, label: "Analitik", exact: true },
    { href: `${base}/menu`, label: "Menü" },
    { href: `${base}/branches`, label: isOwner ? "Şubeler" : "Şubem" },
    { href: `${base}/qr`, label: "QR Kodlar" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {links.map((l) => {
        const active = l.exact ? path === l.href : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`rounded-md px-3 py-1.5 ${active ? "bg-ink text-white" : "text-muted hover:bg-paper"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
