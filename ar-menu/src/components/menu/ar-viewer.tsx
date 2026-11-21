"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuModel } from "./types";

type ModelViewerElement = HTMLElement & {
  getDimensions?: () => { x: number; y: number; z: number };
  canActivateAR?: boolean;
  scale?: string;
};

/**
 * 3D önizleme + AR. Gerçek boyut garantisi:
 *  - ar-scale="fixed": misafir AR'da modeli büyütüp küçültemez.
 *  - Model yüklenince ölçülen boyut, işletmenin girdiği gerçek boyuta (cm) göre ölçeklenir;
 *    böylece model hangi birimle üretilmiş olursa olsun masada gerçek boyutta görünür.
 */
export type ArLabels = { place: string; size: string; loading: string; failed: string; unsupported: string };
const DEFAULT_LABELS: ArLabels = {
  place: "Masama yerleştir", size: "Gerçek boyut", loading: "3D model hazırlanıyor…",
  failed: "3D model yüklenemedi. Lütfen daha sonra tekrar deneyin.",
  unsupported: "Bu cihaz AR desteklemiyor. Modeli parmağınızla döndürerek inceleyebilirsiniz.",
};

export function ArViewer({
  model, alt, onArOpen, onPlaced, labels = DEFAULT_LABELS,
}: { model: MenuModel; alt: string; onArOpen?: () => void; onPlaced?: () => void; labels?: ArLabels }) {
  const ref = useRef<ModelViewerElement | null>(null);
  const scaled = useRef(false);
  const [ready, setReady] = useState(false);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => !cancelled && setReady(true)).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;

    const onLoad = () => {
      if (!scaled.current && el.getDimensions) {
        const d = el.getDimensions();
        const natural = Math.max(d.x, d.z);
        const target = Math.max(model.width_cm, model.depth_cm) / 100;
        if (natural > 0 && target > 0) {
          const f = target / natural;
          if (Math.abs(f - 1) > 0.02) el.setAttribute("scale", `${f} ${f} ${f}`);
        }
        scaled.current = true;
      }
      setArSupported(Boolean(el.canActivateAR));
    };
    const onError = () => setFailed(true);
    const onAr = (e: Event) => {
      const status = (e as CustomEvent<{ status: string }>).detail?.status;
      if (status === "object-placed") onPlaced?.();
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    el.addEventListener("ar-status", onAr);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
      el.removeEventListener("ar-status", onAr);
    };
  }, [ready, model.width_cm, model.depth_cm, onPlaced]);

  if (failed) {
    return <p className="p-6 text-center text-sm text-muted">{labels.failed}</p>;
  }

  return (
    <div className="relative h-[60dvh] w-full overflow-hidden rounded-xl bg-gradient-to-b from-stone-100 to-stone-200">
      {ready ? (
        <model-viewer
          ref={ref as React.Ref<HTMLElement>}
          src={model.glb_url}
          ios-src={model.usdz_url ?? undefined}
          poster={model.poster_url ?? undefined}
          alt={alt}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          camera-controls
          touch-action="pan-y"
          shadow-intensity="1"
          exposure="1"
          style={{ width: "100%", height: "100%" }}
        >
          <button
            slot="ar-button"
            onClick={() => onArOpen?.()}
            className="btn-primary absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 text-base shadow-lg"
          >
            {labels.place}
          </button>
        </model-viewer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">{labels.loading}</div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/80 px-2 py-1 text-xs text-ink">
        {labels.size}: <span dir="ltr">{model.width_cm}×{model.depth_cm}×{model.height_cm} cm</span>
      </div>
      {arSupported === false && (
        <p className="absolute bottom-3 left-3 right-3 rounded-md bg-white/90 p-2 text-center text-xs text-muted">
          {labels.unsupported}
        </p>
      )}
    </div>
  );
}
