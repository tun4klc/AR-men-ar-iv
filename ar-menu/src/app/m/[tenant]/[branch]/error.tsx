"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Menü açılamadığında (veritabanı yanıt vermedi, zaman aşımı vb.) misafirin gördüğü ekran.
 * Boş/beyaz hata sayfası yerine menünün kendi görünümünde, telefonun dilinde ve "tekrar dene" ile.
 */
const TEXT: Record<string, { title: string; body: string; retry: string; retrying: string }> = {
  tr: { title: "Menü şu an açılamadı", body: "Bağlantıda kısa bir aksaklık oldu. Birkaç saniye sonra tekrar deneyin.", retry: "Tekrar dene", retrying: "Yükleniyor…" },
  en: { title: "The menu couldn't be opened", body: "There was a brief connection problem. Please try again in a few seconds.", retry: "Try again", retrying: "Loading…" },
  de: { title: "Die Speisekarte konnte nicht geöffnet werden", body: "Es gab eine kurze Verbindungsstörung. Bitte versuchen Sie es in ein paar Sekunden erneut.", retry: "Erneut versuchen", retrying: "Wird geladen…" },
  ru: { title: "Не удалось открыть меню", body: "Произошёл кратковременный сбой связи. Попробуйте ещё раз через несколько секунд.", retry: "Повторить", retrying: "Загрузка…" },
  ar: { title: "تعذّر فتح القائمة", body: "حدث خلل قصير في الاتصال. يرجى المحاولة مرة أخرى بعد بضع ثوانٍ.", retry: "أعد المحاولة", retrying: "جارٍ التحميل…" },
};

function pick(): string {
  if (typeof navigator === "undefined") return "tr";
  try {
    const saved = localStorage.getItem("arm_lang");
    if (saved && TEXT[saved]) return saved;
  } catch { /* yok say */ }
  for (const l of navigator.languages ?? []) {
    const base = l.toLowerCase().split("-")[0];
    if (TEXT[base]) return base;
  }
  return "tr";
}

export default function MenuError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [lang, setLang] = useState("tr");
  const [pending, startTransition] = useTransition();
  useEffect(() => { setLang(pick()); }, []);
  useEffect(() => { console.error("Menü hatası:", error.digest ?? error.message); }, [error]);
  const t = TEXT[lang];

  // Sunucuda oluşan hatada yalnızca reset() yetmez: sayfa verisi de yeniden istenir.
  const retry = () => startTransition(() => { router.refresh(); reset(); });

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "#1d120c", color: "#f3e7d6" }}>
      <svg width="40" height="56" viewBox="0 0 40 56" aria-hidden style={{ color: "#d6a66c" }}>
        <ellipse cx="20" cy="28" rx="17" ry="25" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 5c-7 10 7 20 0 30s0 14 0 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="max-w-sm text-base" style={{ color: "rgb(243 231 214 / 0.7)" }}>{t.body}</p>
      <button type="button" onClick={retry} disabled={pending}
        className="mt-2 rounded-full px-6 py-3 font-semibold disabled:opacity-60"
        style={{ background: "#f3e7d6", color: "#1d120c" }}>
        {pending ? t.retrying : t.retry}
      </button>
    </main>
  );
}
