export default function InvalidQr() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-bold">QR kod geçersiz</h1>
      <p className="text-muted">Bu kod artık kullanılmıyor. Lütfen masadaki güncel QR kodu okutun veya personelden yardım isteyin.</p>
    </main>
  );
}
