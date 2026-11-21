"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { saveProductModel, setProductImage, deleteProductModel } from "../../actions";
import { ImageCropper } from "./image-cropper";
import { THUMB_SIZE, thumbPath } from "@/lib/media-paths";

type FileRef = { path: string; url: string | null };
type ModelState = { glb: FileRef; usdz: FileRef | null; poster: FileRef | null; width_cm: number; depth_cm: number; height_cm: number };

const MB = 1024 * 1024;
const KINDS = {
  image: { max: 5 * MB, exts: ["jpg", "jpeg", "png", "webp"], label: "JPG, PNG, WebP veya telefon fotoğrafı; büyük görseller otomatik küçültülür" },
  glb: { max: 15 * MB, exts: ["glb"], label: "GLB, en fazla 15 MB" },
  usdz: { max: 15 * MB, exts: ["usdz"], label: "USDZ, en fazla 15 MB" },
} as const;

/** Dosya imzası (magic bytes) kontrolü: uzantısı değiştirilmiş dosyaları reddeder. */
async function sniff(file: File): Promise<"jpeg" | "png" | "webp" | "glb" | "zip" | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const s = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && s(1, 4) === "PNG") return "png";
  if (s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "webp";
  if (s(0, 4) === "glTF") return "glb";
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  return null;
}

/**
 * Görseli tarayıcıda menüye uygun hale getirir: telefonun döndürme bilgisini uygular,
 * uzun kenarı en fazla 1600 px olacak şekilde küçültür ve JPG'ye çevirir.
 * Böylece 10 MB'lık telefon fotoğrafları, uzantısı farklı/eksik dosyalar ve iPhone (HEIC)
 * görselleri de sorunsuz yüklenir; menü de hızlı açılır.
 */
async function prepareImage(file: File): Promise<File> {
  if (file.size > 40 * MB) throw new Error("Görsel çok büyük (en fazla 40 MB seçebilirsiniz).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Bu görsel açılamadı. Lütfen JPG veya PNG formatında bir fotoğraf seçin.");
  }
  const MAX = 1600;
  const k = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Görsel işlenemedi.");
  g.fillStyle = "#ffffff"; // saydam PNG'ler siyah görünmesin
  g.fillRect(0, 0, w, h);
  g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) throw new Error("Görsel işlenemedi.");
  return new File([blob], "gorsel.jpg", { type: "image/jpeg" });
}

/** Menü listesi için küçük kare kopya (~15 KB). Büyük fotoğraf detay sayfasında kullanılır. */
async function makeThumb(file: File): Promise<Blob | null> {
  try {
    const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
    const side = Math.min(bm.width, bm.height);
    const c = document.createElement("canvas");
    c.width = THUMB_SIZE; c.height = THUMB_SIZE;
    const g = c.getContext("2d");
    if (!g) return null;
    g.imageSmoothingQuality = "high";
    g.drawImage(bm, (bm.width - side) / 2, (bm.height - side) / 2, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
    bm.close();
    return await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

const CONTENT_TYPE: Record<string, string> = {
  jpeg: "image/jpeg", png: "image/png", webp: "image/webp", glb: "model/gltf-binary", zip: "model/vnd.usdz+zip",
};

export function MediaManager({ tenantSlug, tenantId, productId, image, model }: {
  tenantSlug: string; tenantId: string; productId: string; image: FileRef | null; model: ModelState | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [msgFor, setMsgFor] = useState<string | null>(null); // mesaj hangi bölümde gösterilsin
  const [cropFile, setCropFile] = useState<File | null>(null); // kırpılmayı bekleyen ürün fotoğrafı
  const [img, setImg] = useState<FileRef | null>(image);
  const [m, setM] = useState<Partial<ModelState>>(model ?? {});
  const [, startTransition] = useTransition();

  async function upload(input: File, kind: keyof typeof KINDS, prepared = false): Promise<FileRef> {
    const spec = KINDS[kind];
    const file = kind === "image" && !prepared ? await prepareImage(input) : input;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(spec.exts as readonly string[]).includes(ext)) throw new Error(`Desteklenmeyen dosya: ${spec.label}`);
    if (file.size > spec.max) throw new Error(`Dosya çok büyük: ${spec.label}`);
    const sig = await sniff(file);
    const okSig = kind === "image" ? sig === "jpeg" || sig === "png" || sig === "webp" : kind === "glb" ? sig === "glb" : sig === "zip";
    if (!okSig || !sig) throw new Error("Dosya içeriği uzantısıyla uyuşmuyor.");

    const path = `${tenantId}/products/${productId}/${crypto.randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
    const { error } = await createBrowserSupabase().storage.from("menu-media")
      .upload(path, file, { contentType: CONTENT_TYPE[sig], upsert: false, cacheControl: "31536000" });
    if (error) throw new Error("Yükleme başarısız. Bağlantınızı kontrol edip tekrar deneyin.");
    return { path, url: URL.createObjectURL(file) };
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(null); setNotice(null); setMsgFor(label);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Bir hata oluştu."); }
    finally { setBusy(null); }
  }

  // Kırpma aracından gelen kare fotoğraf zaten 1200 px JPG; yeniden işlenmez.
  const onImage = (file?: File) => file && run("image", async () => {
    const ref = await upload(file, "image", true);
    // Küçük kopya: başarısız olursa menü büyük fotoğrafa döner, kullanıcıyı durdurmaya gerek yok.
    const thumb = await makeThumb(file);
    if (thumb) {
      await createBrowserSupabase().storage.from("menu-media")
        .upload(thumbPath(ref.path), thumb, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" })
        .catch(() => {});
    }
    let res: Awaited<ReturnType<typeof setProductImage>>;
    try {
      res = await setProductImage(productId, tenantSlug, ref.path);
    } catch {
      res = { error: "Sunucuya ulaşılamadı. Sayfayı yenileyip tekrar deneyin." };
    }
    if (res?.error) {
      // Kaydedilemeyen dosyayı depoda sahipsiz bırakma.
      await createBrowserSupabase().storage.from("menu-media").remove([ref.path, thumbPath(ref.path)]).catch(() => {});
      throw new Error(res.error);
    }
    setImg(ref); setNotice(res?.ok ?? "Görsel güncellendi.");
    startTransition(() => router.refresh());
  });

  const onModelFile = (file: File | undefined, kind: "glb" | "usdz" | "poster") => file && run(kind, async () => {
    const ref = await upload(file, kind === "poster" ? "image" : kind);
    setM((s) => ({ ...s, [kind]: ref }));
  });

  const saveModel = () => run("save", async () => {
    if (!m.glb) throw new Error("Önce GLB dosyasını yükleyin.");
    if (!m.width_cm || !m.depth_cm || !m.height_cm) throw new Error("Gerçek boyutları (cm) girin.");
    const res = await saveProductModel(tenantSlug, productId, {
      glb_path: m.glb.path, usdz_path: m.usdz?.path ?? null, poster_path: m.poster?.path ?? null,
      width_cm: m.width_cm, depth_cm: m.depth_cm, height_cm: m.height_cm,
    });
    if (res?.error) throw new Error(res.error);
    setNotice(res?.ok ?? "Kaydedildi.");
    startTransition(() => router.refresh());
  });

  const forImage = msgFor === "image";
  const messages = (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
    </>
  );
  const imgMsg = forImage ? messages : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <section className="card flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Ürün fotoğrafı</h2>
          <p className="text-xs text-muted">Menüde müşterinin gördüğü fotoğraf budur.</p>
        </div>
        {img?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
        ) : <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 text-sm text-muted">Görsel yok</div>}
        <label className="btn-ghost cursor-pointer">
          {busy === "image" ? "Yükleniyor…" : img ? "Görseli değiştir" : "Görsel yükle"}
          <input type="file" accept="image/*" className="sr-only" disabled={!!busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(null); setNotice(null); setCropFile(f); } e.target.value = ""; }} />
        </label>
        <p className="text-xs text-muted">{KINDS.image.label}</p>
        {busy === "image" && <p role="status" className="text-sm text-muted">Fotoğraf yükleniyor…</p>}
        {imgMsg}
        {cropFile && (
          <ImageCropper file={cropFile} onCancel={() => setCropFile(null)}
            onDone={(f) => { setCropFile(null); onImage(f); }} />
        )}
      </section>

      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">3D model ve AR</h2>
          <p className="text-xs text-muted">
            Misafir &quot;AR&apos;da Gör&quot;e bastığında yemek, aşağıda girdiğiniz <b>gerçek boyutta</b> masaya yerleştirilir ve büyütülüp küçültülemez.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilePick label="GLB model (zorunlu)" hint={KINDS.glb.label} accept=".glb,model/gltf-binary" done={!!m.glb}
            busy={busy === "glb"} disabled={!!busy} onPick={(f) => onModelFile(f, "glb")} />
          <FilePick label="USDZ (iPhone, isteğe bağlı)" hint="Yoksa iPhone için GLB'den otomatik üretilir" accept=".usdz" done={!!m.usdz}
            busy={busy === "usdz"} disabled={!!busy} onPick={(f) => onModelFile(f, "usdz")} />
          <FilePick label="3D kapak görseli (isteğe bağlı)"
            hint={m.glb ? "3D model yüklenirken gösterilir; \"3D modeli kaydet\" ile kaydedilir" : "Önce GLB modeli yükleyin. Menü fotoğrafı için soldaki alanı kullanın."}
            accept="image/*" done={!!m.poster}
            busy={busy === "poster"} disabled={!!busy || !m.glb} onPick={(f) => onModelFile(f, "poster")} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["width_cm", "depth_cm", "height_cm"] as const).map((k) => (
            <div key={k}>
              <label className="label">{k === "width_cm" ? "Genişlik (cm)" : k === "depth_cm" ? "Derinlik (cm)" : "Yükseklik (cm)"}</label>
              <input type="number" min={0.5} max={200} step={0.5} className="input" value={m[k] ?? ""}
                onChange={(e) => setM((s) => ({ ...s, [k]: e.target.value === "" ? undefined : Number(e.target.value) }))} />
            </div>
          ))}
        </div>

        {m.glb?.url && (
          <ModelPreview url={m.glb.url} target={m} onUseMeasured={(d) => setM((s) => ({ ...s, ...d }))} />
        )}
        {m.usdz && <p className="text-xs text-warn">Not: Kendi USDZ dosyanızı yüklediyseniz iPhone&apos;da bu dosya olduğu gibi kullanılır; dosyanın gerçek boyutta (metre) hazırlanmış olduğundan emin olun.</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!forImage && messages}
          {model && (
            <form action={deleteProductModel} onSubmit={() => setM({})}>
              <input type="hidden" name="tenant" value={tenantSlug} /><input type="hidden" name="id" value={productId} />
              <button className="btn-danger" disabled={!!busy}>3D modeli kaldır</button>
            </form>
          )}
          <button onClick={saveModel} disabled={!!busy || !m.glb} className="btn-primary">{busy === "save" ? "Kaydediliyor…" : "3D modeli kaydet"}</button>
        </div>
      </section>
    </div>
  );
}

function FilePick({ label, hint, accept, done, busy, disabled, onPick }: {
  label: string; hint: string; accept: string; done: boolean; busy: boolean; disabled: boolean; onPick: (f?: File) => void;
}) {
  return (
    <label className={`flex flex-col gap-1 rounded-lg border border-dashed p-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${done ? "border-ok bg-ok/5" : "border-line"}`}>
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted">{busy ? "Yükleniyor…" : done ? "Yüklendi ✓ (değiştirmek için tıklayın)" : hint}</span>
      <input type="file" accept={accept} className="sr-only" disabled={disabled}
        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}

type Dims = { width_cm: number; depth_cm: number; height_cm: number };

/** Yönetici önizlemesi: modelin dosyadaki boyutunu ölçer, girilen gerçek boyutla karşılaştırır. */
function ModelPreview({ url, target, onUseMeasured }: { url: string; target: Partial<Dims>; onUseMeasured: (d: Dims) => void }) {
  const ref = useRef<HTMLElement & { getDimensions?: () => { x: number; y: number; z: number } }>(null);
  const [ready, setReady] = useState(false);
  const [measured, setMeasured] = useState<Dims | null>(null);

  useEffect(() => { import("@google/model-viewer").then(() => setReady(true)); }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const onLoad = () => {
      const d = el.getDimensions?.();
      if (d) setMeasured({ width_cm: round(d.x * 100), depth_cm: round(d.z * 100), height_cm: round(d.y * 100) });
    };
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [ready, url]);

  const factor = measured && target.width_cm && target.depth_cm
    ? Math.max(target.width_cm, target.depth_cm) / Math.max(measured.width_cm, measured.depth_cm) : null;
  const suspicious = factor !== null && (factor > 20 || factor < 0.05);

  return (
    <div className="flex flex-col gap-2">
      <div className="h-72 overflow-hidden rounded-lg bg-stone-100">
        {ready && <model-viewer ref={ref} src={url} camera-controls touch-action="pan-y" shadow-intensity="1" style={{ width: "100%", height: "100%" }} />}
      </div>
      {measured && (
        <div className="rounded-lg bg-paper p-3 text-xs">
          <p>Model dosyasındaki boyut: <b>{measured.width_cm} × {measured.depth_cm} × {measured.height_cm} cm</b></p>
          {factor !== null && Math.abs(factor - 1) > 0.02 && (
            <p className={suspicious ? "text-danger" : "text-muted"}>
              Menüde girdiğiniz gerçek boyuta göre ×{factor.toFixed(2)} ölçeklenecek.
              {suspicious && " Oran çok büyük — model birimi veya girilen boyut hatalı olabilir."}
            </p>
          )}
          <button type="button" className="mt-2 text-brand underline" onClick={() => onUseMeasured(measured)}>
            Boyutları modelden al
          </button>
        </div>
      )}
    </div>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
