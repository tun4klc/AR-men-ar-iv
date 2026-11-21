"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Kontrol Merkezi'nde beklenmeyen hata: ayrıntı gizlenir, "tekrar dene" sunulur. */
export default function ControlError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => { console.error("Kontrol Merkezi hatası:", error.digest ?? error.message); }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="card text-center">
        <h1 className="font-semibold">İşlem tamamlanamadı</h1>
        <p className="mt-1 text-sm text-muted">
          {process.env.NODE_ENV === "development" ? error.message : "Bağlantıda bir sorun olabilir. Tekrar deneyin; sorun sürerse sayfayı yenileyin."}
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Kod: {error.digest}</p>}
        <button className="btn-ghost mt-4" disabled={pending}
          onClick={() => startTransition(() => { router.refresh(); reset(); })}>
          {pending ? "Yükleniyor…" : "Tekrar dene"}
        </button>
      </div>
    </main>
  );
}
