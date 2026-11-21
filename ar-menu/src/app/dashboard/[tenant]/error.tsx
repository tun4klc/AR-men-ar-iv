"use client";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <h2 className="font-semibold">İşlem tamamlanamadı</h2>
      <p className="mt-1 text-sm text-muted">{process.env.NODE_ENV === "development" ? error.message : "Lütfen tekrar deneyin. Sorun sürerse sayfayı yenileyin."}</p>
      <button onClick={reset} className="btn-ghost mt-4">Tekrar dene</button>
    </div>
  );
}
