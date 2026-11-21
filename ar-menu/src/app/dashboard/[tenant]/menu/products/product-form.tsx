"use client";

import { useActionState } from "react";
import { ALLERGENS } from "@/lib/format";
import { EXTRA_LANGS, LANG_LABEL_TR, RTL_LANGS, type Translations } from "@/lib/menu-i18n";
import type { ActionState } from "../actions";

export type ProductValues = {
  id?: string; category_id: string; name_tr: string; name_en: string | null; description_tr: string | null;
  description_en: string | null; base_price: number; is_active: boolean; allergens: string[];
  translations?: Translations | null;
};

export function ProductForm({ tenant, categories, values, action, version }: {
  tenant: string;
  /** Kayıt sürümü: değişince çeviri alanları sunucudan gelen yeni çevirilerle yenilenir. */
  version?: string;
  categories: { id: string; name_tr: string }[];
  values?: ProductValues;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = values;
  return (
    <form action={formAction} className="card grid gap-4 md:grid-cols-2">
      <input type="hidden" name="tenant" value={tenant} />
      {v?.id && <input type="hidden" name="id" value={v.id} />}
      <div><label className="label" htmlFor="name_tr">Ürün adı (TR)</label>
        <input id="name_tr" name="name_tr" defaultValue={v?.name_tr} required maxLength={120} className="input" /></div>
      <div><label className="label" htmlFor="description_tr">Açıklama (TR)</label>
        <textarea id="description_tr" name="description_tr" defaultValue={v?.description_tr ?? ""} maxLength={1000} rows={3} className="input" /></div>

      <details key={version} className="rounded-lg border border-line p-3 md:col-span-2" open={!!v?.id}>
        <summary className="cursor-pointer text-sm font-semibold">Çeviriler (İngilizce, Almanca, Rusça, Arapça)</summary>
        <p className="mt-2 text-xs text-muted">
          Boş bıraktığınız diller kaydederken Türkçeden otomatik çevrilir. Türkçe metni değiştirdiğinizde, elle
          düzeltmediğiniz çeviriler de yenilenir. Elle yazdığınız çeviriler korunur.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="name_en">Ürün adı ({LANG_LABEL_TR.en})</label>
            <input id="name_en" name="name_en" defaultValue={v?.name_en ?? ""} maxLength={120} className="input" /></div>
          <div><label className="label" htmlFor="description_en">Açıklama ({LANG_LABEL_TR.en})</label>
            <textarea id="description_en" name="description_en" defaultValue={v?.description_en ?? ""} maxLength={1000} rows={2} className="input" /></div>
          {EXTRA_LANGS.map((l) => {
            const t = v?.translations?.[l];
            const dir = RTL_LANGS.has(l) ? "rtl" : "ltr";
            return [
              <div key={`n-${l}`}><label className="label" htmlFor={`name_${l}`}>Ürün adı ({LANG_LABEL_TR[l]})</label>
                <input id={`name_${l}`} name={`name_${l}`} dir={dir} lang={l} defaultValue={t?.name ?? ""} maxLength={120} className="input" /></div>,
              <div key={`d-${l}`}><label className="label" htmlFor={`description_${l}`}>Açıklama ({LANG_LABEL_TR[l]})</label>
                <textarea id={`description_${l}`} name={`description_${l}`} dir={dir} lang={l} defaultValue={t?.description ?? ""} maxLength={1000} rows={2} className="input" /></div>,
            ];
          })}
        </div>
        {v?.id && (
          <button name="retranslate" value="1" disabled={pending} className="btn-ghost mt-3 text-xs">
            Tüm çevirileri Türkçeden yeniden oluştur
          </button>
        )}
      </details>
      <div><label className="label" htmlFor="category_id">Kategori</label>
        <select id="category_id" name="category_id" defaultValue={v?.category_id ?? categories[0]?.id} className="input">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_tr}</option>)}
        </select></div>
      <div><label className="label" htmlFor="base_price">Fiyat (₺) — tüm şubeler için varsayılan</label>
        <input id="base_price" name="base_price" defaultValue={v ? Number(v.base_price).toFixed(2) : ""} required inputMode="decimal" className="input" /></div>
      <fieldset className="md:col-span-2">
        <legend className="label">Alerjenler</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-sm">
              <input type="checkbox" name="allergens" value={key} defaultChecked={v?.allergens.includes(key)} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={v?.is_active ?? true} /> Menüde yayında
      </label>
      <div className="flex items-center justify-end gap-3 md:col-span-1">
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        <button disabled={pending} className="btn-primary">{pending ? "Kaydediliyor ve çevriliyor…" : v?.id ? "Kaydet" : "Ürünü oluştur"}</button>
      </div>
    </form>
  );
}
