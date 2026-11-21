export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-bold">Sayfa bulunamadı</h1>
      <p className="text-muted">Aradığınız menü ya da sayfa mevcut değil veya yayından kaldırılmış.</p>
    </main>
  );
}
