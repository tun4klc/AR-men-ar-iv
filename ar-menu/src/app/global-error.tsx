"use client";

/**
 * Son savunma hattı: kök düzende (layout) hata olursa bile boş beyaz sayfa yerine
 * kendi html/body'si olan sade bir ekran gösterilir.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, sans-serif", background: "#1d120c", color: "#f3e7d6", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>Sayfa şu an açılamadı</h1>
          <p style={{ margin: "0 0 20px", opacity: 0.75 }}>Lütfen birkaç saniye sonra tekrar deneyin. · Please try again in a few seconds.</p>
          <button type="button" onClick={() => { reset(); location.reload(); }}
            style={{ border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, background: "#f3e7d6", color: "#1d120c", cursor: "pointer" }}>
            Tekrar dene · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
