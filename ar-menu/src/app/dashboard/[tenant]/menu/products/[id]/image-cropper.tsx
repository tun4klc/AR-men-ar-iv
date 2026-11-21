"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kare kırpma aracı: işletme sahibi fotoğrafı sürükleyip yakınlaştırarak yemeği karenin
 * ortasına getirir. Sonuç 1200×1200 JPG olarak döner; menüdeki küçük kare ve detay
 * sayfası bu kareyi olduğu gibi gösterir.
 */

const OUT = 1200;
const MAX_ZOOM = 4;

type View = { zoom: number; x: number; y: number };

export function ImageCropper({ file, onCancel, onDone }: {
  file: File; onCancel: () => void; onDone: (cropped: File) => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(320);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Telefonun döndürme bilgisi uygulanmış haliyle aç.
  useEffect(() => {
    let alive = true;
    let bm: ImageBitmap | null = null;
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((b) => { bm = b; if (alive) setBitmap(b); else b.close(); })
      .catch(() => alive && setError("Bu görsel açılamadı. Lütfen JPG veya PNG formatında bir fotoğraf seçin."));
    return () => { alive = false; bm?.close(); };
  }, [file]);

  // Kare, ekran genişliğine sığsın.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(Math.min(e.contentRect.width, 420))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Fotoğraf kareyi her zaman tamamen doldursun: boşluk kalacak kadar kaydırılamaz. */
  const clamp = useCallback((v: View, s = size): View => {
    if (!bitmap) return v;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
    const base = s / Math.min(bitmap.width, bitmap.height);
    const w = bitmap.width * base * zoom, h = bitmap.height * base * zoom;
    const mx = (w - s) / 2, my = (h - s) / 2;
    return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, [bitmap, size]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, s: number, v: View, k: number) => {
    if (!bitmap) return;
    const base = s / Math.min(bitmap.width, bitmap.height);
    const w = bitmap.width * base * v.zoom, h = bitmap.height * base * v.zoom;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, s * k, s * k);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, ((s - w) / 2 + v.x) * k, ((s - h) / 2 + v.y) * k, w * k, h * k);
  }, [bitmap]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !bitmap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (ctx) draw(ctx, size, clamp(view), dpr);
  }, [bitmap, size, view, draw, clamp]);

  const update = (fn: (v: View) => View) => setView((v) => clamp(fn(v)));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = pinch.current.zoom * (d / pinch.current.dist);
      update((v) => ({ ...v, zoom: z }));
    } else if (pointers.current.size === 1) {
      update((v) => ({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (e: React.WheelEvent) => update((v) => ({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }));

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 6;
    const moves: Record<string, (v: View) => View> = {
      ArrowLeft: (v) => ({ ...v, x: v.x - step }), ArrowRight: (v) => ({ ...v, x: v.x + step }),
      ArrowUp: (v) => ({ ...v, y: v.y - step }), ArrowDown: (v) => ({ ...v, y: v.y + step }),
      "+": (v) => ({ ...v, zoom: v.zoom * 1.1 }), "-": (v) => ({ ...v, zoom: v.zoom / 1.1 }),
    };
    if (moves[e.key]) { e.preventDefault(); update(moves[e.key]); }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && !saving && onCancel();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel, saving]);

  async function save() {
    if (!bitmap) return;
    setSaving(true);
    const out = document.createElement("canvas");
    out.width = OUT; out.height = OUT;
    const ctx = out.getContext("2d");
    if (!ctx) { setSaving(false); setError("Görsel işlenemedi."); return; }
    draw(ctx, size, clamp(view), OUT / size);
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.88));
    if (!blob) { setSaving(false); setError("Görsel işlenemedi."); return; }
    onDone(new File([blob], "urun.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"
      aria-labelledby="crop-title">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
        <h2 id="crop-title" className="text-lg font-semibold">Fotoğrafı ortala</h2>
        <p className="mt-1 text-sm text-muted">Yemeği karenin ortasına sürükleyin, gerekirse yakınlaştırın. Menüde bu kare görünür.</p>

        <div ref={box} className="mt-4 w-full">
          {error ? (
            <p role="alert" className="rounded-lg bg-danger/5 p-4 text-sm text-danger">{error}</p>
          ) : (
            <div className="relative mx-auto overflow-hidden rounded-xl bg-stone-100" style={{ width: size, height: size }}>
              <canvas ref={canvas} tabIndex={0} aria-label="Kırpma alanı. Ok tuşlarıyla kaydırın, artı ve eksiyle yakınlaştırın."
                className="block h-full w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKey} />
              {/* Ortayı gösteren ince kılavuz: üçte bir çizgileri ve merkez. */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
              </div>
              {!bitmap && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Fotoğraf açılıyor…</div>}
            </div>
          )}
        </div>

        {!error && (
          <label className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-muted">Yakınlaştır</span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} className="flex-1 accent-[var(--color-brand)]"
              onChange={(e) => update((v) => ({ ...v, zoom: Number(e.target.value) }))} disabled={!bitmap} />
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>Vazgeç</button>
          {!error && (
            <button type="button" className="btn-primary" onClick={save} disabled={!bitmap || saving}>
              {saving ? "Hazırlanıyor…" : "Kaydet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
