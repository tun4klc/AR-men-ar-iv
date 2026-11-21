import Link from "next/link";
import { logout } from "@/lib/login-actions";

export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="font-bold text-brand">Kontrol Merkezi</Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/" className="rounded-md px-3 py-1.5 text-muted hover:bg-white/5">İşletmeler</Link>
            <Link href="/audit" className="rounded-md px-3 py-1.5 text-muted hover:bg-white/5">Denetim kaydı</Link>
          </nav>
          <span className="ml-auto text-xs text-muted">{email}</span>
          <form action={logout}><button className="btn-ghost px-3 py-1 text-xs">Çıkış</button></form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

export function StaleBanner({ reason, fetchedAt }: { reason: string; fetchedAt: string | null }) {
  return (
    <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
      <b>Canlı veri alınamadı:</b> {reason}{" "}
      {fetchedAt ? `Aşağıdaki liste ${new Date(fetchedAt).toLocaleString("tr-TR")} tarihli son bilinen durumdur.` : "Gösterilecek kayıtlı veri yok."}
      {" "}Bu sırada yapılan aç/kapat işlemleri uygulanmaz.
    </div>
  );
}
