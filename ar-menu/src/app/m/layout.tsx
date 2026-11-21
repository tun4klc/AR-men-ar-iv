import { Amiri, Figtree, Lora, Manrope, Noto_Sans_Arabic, Young_Serif } from "next/font/google";

// Menü sayfasına özel yazı tipleri: kafe tabelası havasında bir serif + okunaklı bir gövde.
const display = Young_Serif({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-display", display: "swap" });
const text = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap" });

// Rusça ve Arapça harfler için eşlenik yazı tipleri. Yalnızca o alfabenin harf aralığını kapsar
// (Latin harfler yine yukarıdakilerden gelir) ve yalnızca sayfada o alfabe kullanılınca indirilir.
const displayCyr = Lora({ display: "swap", preload: false, adjustFontFallback: false, subsets: ["cyrillic"], weight: ["500"], variable: "--font-display-cyr" });
const textCyr = Manrope({ display: "swap", preload: false, adjustFontFallback: false, subsets: ["cyrillic"], variable: "--font-text-cyr" });
const displayAr = Amiri({ display: "swap", preload: false, adjustFontFallback: false, subsets: ["arabic"], weight: ["700"], variable: "--font-display-ar" });
const textAr = Noto_Sans_Arabic({ display: "swap", preload: false, adjustFontFallback: false, subsets: ["arabic"], variable: "--font-text-ar" });

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const vars = [display, text, displayCyr, textCyr, displayAr, textAr].map((f) => f.variable).join(" ");
  return <div className={vars}>{children}</div>;
}
