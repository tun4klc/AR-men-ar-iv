"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArViewer } from "./ar-viewer";
import { EspressoHero } from "./espresso-hero";
import { track } from "./track";
import type { MenuData, MenuProduct } from "./types";
import { LANG_LABEL, MENU_LANGS, RTL_LANGS, isMenuLang, localized, type MenuLang } from "@/lib/menu-i18n";
import { ALLERGEN_LABELS, LANG_STORAGE_KEY, STRINGS, formatMenuPrice } from "./strings";
import "./menu.css";

type Lang = MenuLang;
const HERO_VIDEO = process.env.NEXT_PUBLIC_MENU_HERO_VIDEO || undefined;

/** Kaydırmaya bağlı tüm hareket tek bir rAF döngüsünde: hero, görseller, çekirdekler. */
function useScrollMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY, vh = window.innerHeight;
      el.style.setProperty("--sy", String(y));
      el.style.setProperty("--hero", String(Math.min(1, y / vh)));
      el.querySelectorAll<HTMLElement>("[data-parallax]").forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const k = Number(node.dataset.parallax) || 0.12;
        const off = ((r.top + r.height / 2) - vh / 2) * -k;
        node.style.setProperty("--p", `${off.toFixed(1)}px`);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [root]);
}

/** Görseller ekrana girerken perdeyi aralar gibi açılır (tek açılış hareketi). */
function useReveal(root: React.RefObject<HTMLDivElement | null>, key: string) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    el.querySelectorAll("[data-reveal]:not([data-in])").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root, key]);
}

export function MenuView({ menu, table, initialLang }: { menu: MenuData; table: string | null; initialLang: MenuLang }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<MenuProduct | null>(null);
  const [arProduct, setArProduct] = useState<MenuProduct | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const t = STRINGS[lang];
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";

  // Misafir daha önce elle dil seçtiyse onu kullan; yoksa sunucunun telefondan algıladığı dil kalır.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (isMenuLang(saved)) setLangState(saved);
    } catch { /* gizli sekme vb. */ }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* yok say */ }
  }, []);
  const branchId = menu.branch.id;

  useEffect(() => { track(branchId, "menu_view"); }, [branchId]);
  useScrollMotion(root);

  const name = useCallback((p: Parameters<typeof localized>[0]) => localized(p, lang).name, [lang]);
  const desc = (p: MenuProduct) => localized(p, lang).description;
  const price = (v: number) => formatMenuPrice(v, lang);

  // Arama tüm dillerde çalışır (misafir hangi dilde yazarsa yazsın).
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return menu.products;
    return menu.products.filter((p) => MENU_LANGS.some((l) => {
      const x = localized(p, l);
      return [x.name, x.description].some((s) => s?.toLocaleLowerCase().includes(q));
    }));
  }, [menu.products, query]);

  const sections = menu.categories
    .map((c) => ({ c, items: filtered.filter((p) => p.category_id === c.id) }))
    .filter((s) => s.items.length > 0);

  useReveal(root, `${query}|${lang}|${sections.length}`);

  // Ekrandaki kategoriyi sekme çubuğunda işaretle.
  const sectionKey = sections.map((s) => s.c.id).join(",");
  useEffect(() => {
    const ids = sectionKey ? sectionKey.split(",") : [];
    if (!ids.length) return;
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id.slice(2));
    }, { rootMargin: "-30% 0px -60% 0px" });
    ids.forEach((id) => { const n = document.getElementById(`c-${id}`); if (n) io.observe(n); });
    return () => io.disconnect();
  }, [sectionKey]);

  useEffect(() => { if (searching) searchInput.current?.focus(); }, [searching]);

  const openDetail = (p: MenuProduct) => { setDetail(p); track(branchId, "product_view", p.id); };
  const openAr = (p: MenuProduct) => { setArProduct(p); track(branchId, "product_view", p.id); };
  const toList = () => list.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div ref={root} className="menu-root" dir={dir} lang={lang}>
      <Beans />

      <section className="hero">
        <EspressoHero videoUrl={HERO_VIDEO} />
        <div className="hero-top">
          <LangSwitch lang={lang} setLang={setLang} label={t.language} />
          <span className="hero-welcome">{t.welcome}</span>
        </div>
        <div className="hero-body">
          <div className="logo">
            <span className="logo-mark" aria-hidden>
              <svg viewBox="0 0 40 56" width="18" height="25">
                <ellipse cx="20" cy="28" rx="17" ry="25" fill="none" stroke="currentColor" strokeWidth="2.4" />
                <path d="M20 5c-7 10 7 20 0 30s0 14 0 16" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            <h1 className="logo-name" data-text={menu.tenant.name}>{menu.tenant.name}</h1>
            <p className="logo-branch">
              <span className="logo-rule" aria-hidden />
              <span className="logo-branch-text">{menu.branch.name}</span>
              <span className="logo-rule" aria-hidden />
            </p>
          </div>
          {table && <p className="hero-table">{t.table} {table}</p>}
          <button type="button" onClick={toList} className="hero-cta">
            {t.browse}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </button>
        </div>
      </section>

      <div className="bar">
        {searching ? (
          <div className="bar-search">
            <SearchIcon />
            <input ref={searchInput} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search} aria-label={t.search} />
            <button type="button" className="bar-icon" aria-label={t.clear}
              onClick={() => { setQuery(""); setSearching(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ) : (
          <>
            <nav className="bar-tabs" aria-label={t.categories}>
              {sections.map(({ c }) => (
                <a key={c.id} href={`#c-${c.id}`} aria-current={active === c.id ? "true" : undefined}>{name(c)}</a>
              ))}
            </nav>
            <button type="button" className="bar-icon" aria-label={t.search} onClick={() => setSearching(true)}>
              <SearchIcon />
            </button>
          </>
        )}
      </div>

      <main ref={list} className="list">
        {sections.length === 0 && <p className="empty">{t.empty}</p>}
        {sections.map(({ c, items }) => (
          <section key={c.id} id={`c-${c.id}`} className="cat">
            <header className="cat-head">
              <h2>{name(c)}</h2>
              <span>{t.items(items.length)}</span>
            </header>
            <ul className="cat-items">
              {items.map((p) => (
                <li key={p.id} className="dish">
                  <button type="button" className="dish-open" onClick={() => openDetail(p)}>
                    <span className="dish-frame" data-reveal>
                      {p.thumb_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb_url} alt="" loading="lazy" decoding="async" width={76} height={76} />
                      ) : <span className="dish-blank" />}
                      {!p.is_available && <span className="dish-sold">{t.soldOut}</span>}
                    </span>
                    <span className="dish-text">
                      <span className="dish-line">
                        <span className="dish-name">{name(p)}</span>
                        <span className="dish-leader" aria-hidden />
                        <span className="dish-price">{price(p.price)}</span>
                      </span>
                      {desc(p) && <span className="dish-desc">{desc(p)}</span>}
                    </span>
                  </button>
                  {p.model && (
                    <button type="button" onClick={() => openAr(p)} className="dish-ar" aria-label={`${name(p)}: ${t.ar}`}>
                      <CubeIcon /> {t.ar}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <footer className="foot">{menu.tenant.name} · {menu.branch.name}</footer>
      </main>

      {detail && (
        <Sheet onClose={() => setDetail(null)} closeLabel={t.close}>
          {detail.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.image_url} alt={name(detail)} className="sheet-img" />
          )}
          <div className="sheet-body">
            <div className="dish-line">
              <h3 className="sheet-title">{name(detail)}</h3>
              <span className="dish-leader" aria-hidden />
              <span className="sheet-price">{price(detail.price)}</span>
            </div>
            {!detail.is_available && <p className="sheet-sold">{t.soldOut}</p>}
            {desc(detail) && <p className="sheet-desc">{desc(detail)}</p>}
            {detail.allergens.length > 0 && (
              <p className="sheet-allergens"><strong>{t.allergens}</strong>
                {detail.allergens.map((a) => ALLERGEN_LABELS[lang][a] ?? a).join(lang === "ar" ? "، " : ", ")}</p>
            )}
            {detail.model && (
              <button type="button" onClick={() => { setArProduct(detail); setDetail(null); }} className="sheet-ar">
                <CubeIcon /> {t.ar}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {arProduct?.model && (
        <Sheet onClose={() => setArProduct(null)} closeLabel={t.close}>
          <div className="sheet-body">
            <h3 className="sheet-title mb-3">{name(arProduct)}</h3>
            <ArViewer
              model={arProduct.model}
              alt={name(arProduct)}
              onArOpen={() => track(branchId, "ar_open", arProduct.id)}
              onPlaced={() => track(branchId, "ar_placed", arProduct.id)}
              labels={{ place: t.arPlace, size: t.arSize, loading: t.arLoading, failed: t.arFailed, unsupported: t.arUnsupported }}
            />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Sol üstte açılır dil listesi. */
function LangSwitch({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Açılınca seçili dile odaklan (klavye ile gezilebilsin).
    box.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={box} className="lang" dir="ltr">
      <button ref={button} type="button" className="lang-button" aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${label}: ${LANG_LABEL[lang]}`} onClick={() => setOpen((o) => !o)}>
        <GlobeIcon />
        <span lang={lang}>{LANG_LABEL[lang]}</span>
        <svg className="lang-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="lang-list" role="listbox" aria-label={label} onKeyDown={onListKey}>
          {MENU_LANGS.map((l) => (
            <button key={l} type="button" role="option" aria-selected={lang === l} lang={l}
              dir={RTL_LANGS.has(l) ? "rtl" : "ltr"}
              onClick={() => { setLang(l); setOpen(false); button.current?.focus(); }}>
              <span>{LANG_LABEL[l]}</span>
              {lang === l && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m5 12 5 5 9-10" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

/** Arka planda kaydırdıkça farklı hızlarda süzülen kahve çekirdekleri. */
const BEANS = [
  { x: 4, y: 112, s: 26, v: 0.35, r: 20 }, { x: 88, y: 108, s: 18, v: 0.6, r: -35 },
  { x: 80, y: 150, s: 34, v: 0.22, r: 60 }, { x: 10, y: 170, s: 14, v: 0.55, r: -10 },
  { x: 92, y: 210, s: 22, v: 0.45, r: 110 }, { x: 3, y: 240, s: 16, v: 0.5, r: 75 },
  { x: 70, y: 280, s: 28, v: 0.3, r: -60 },
];

function Beans() {
  return (
    <div className="beans" aria-hidden>
      {BEANS.map((b, i) => (
        <svg key={i} viewBox="0 0 40 56" width={b.s} height={b.s * 1.4}
          style={{ left: `${b.x}%`, top: `${b.y}vh`, ["--v" as string]: b.v, ["--r" as string]: `${b.r}deg` }}>
          <ellipse cx="20" cy="28" rx="18" ry="26" fill="currentColor" />
          <path d="M20 4c-7 10 7 20 0 30s0 16 0 18" stroke="var(--roast)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

function Sheet({ children, onClose, closeLabel }: { children: React.ReactNode; onClose: () => void; closeLabel: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="sheet-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden />
        <button type="button" onClick={onClose} className="sheet-close">{closeLabel}</button>
        {children}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" /><path d="m3 7 9 5 9-5" /><path d="M12 12v10" />
    </svg>
  );
}
