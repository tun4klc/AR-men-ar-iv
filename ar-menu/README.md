# AR Menü — Sistem 1 (Menü Platformu)

Misafir QR menüsü + AR görüntüleme + işletme paneli. Platform yönetimi **bu repoda değildir**:
ayrı alan adında, ayrı hosting ve ayrı veritabanında çalışan `ar-control` (Sistem 2) yönetir.
İki sistem yalnızca imzalı iç API (`/api/control/*`) üzerinden konuşur.

## Akış

| Kim | Ne yapar | Nerede |
|---|---|---|
| Misafir | Masadaki QR'ı okutur | `/q/<token>` → tarama kaydedilir → `/m/<işletme>/<şube>?masa=5` |
| Misafir | Ürüne "AR'da Gör" der | 3D önizleme → "Masama yerleştir" → Android Scene Viewer / iPhone Quick Look / WebXR |
| İşletme | Menü, fiyat, görsel, 3D model | `/dashboard/<işletme>/menu` |
| İşletme | Şubeye özel fiyat/stok | `/dashboard/<işletme>/branches/<şube>` |
| İşletme | Şube şube analitik | `/dashboard/<işletme>?sube=<id>&gun=30` |
| İşletme | Masa QR kodları | `/dashboard/<işletme>/qr` |
| Sistem 2 | İşletme listesi, aç/kapat | `GET /api/control/tenants`, `POST /api/control/tenants/<id>/suspend\|activate` |

## Gerçek boyutta AR

- `ar-scale="fixed"`: misafir modeli büyütüp küçültemez.
- İşletme ürüne gerçek boyutu (cm) girer. Model yüklenince dosyadaki boyut ölçülür ve gerçek boyuta göre
  ölçeklenir. Model hangi birimle üretilmiş olursa olsun masada doğru boyutta görünür. Panel, oran
  şüpheliyse uyarır.
- iPhone için USDZ yüklenmezse model-viewer GLB'den otomatik üretir. Elle USDZ yüklenirse dosyanın
  gerçek boyutta (metre) hazırlanmış olması gerekir.
- Model hazırlama: yemeği telefonla fotogrametri (ör. Polycam, Apple Object Capture) ile tarayın,
  GLB olarak dışa aktarın, gerekirse sıkıştırın:
  `npx @gltf-transform/cli optimize girdi.glb cikti.glb --compress meshopt --texture-compress webp`

## Kill-switch: işletmeyi tek tıkla kapat / aç

Kapatma üç katmanda uygulanır. **Hiçbir veri silinmez.**

1. **Veritabanı:** Tüm RLS politikaları ve misafir RPC'leri `is_tenant_active()` şartını taşır. Askıdaki
   işletme için panel sorguları 0 satır döner, yazmalar reddedilir. `get_public_menu` yalnızca
   `{"status":"suspended"}` döner, olay yazılmaz.
2. **Medya:** Bucket özeldir. İmzalı URL yalnızca işletme aktifken üretilebilir (1 saat geçerli).
3. **Edge:** Askıdaki slug listesi Vercel Edge Config'e yazılır. Middleware menü ve panel rotalarını
   anında "Hizmet durduruldu" sayfasına çevirir.

## Kurulum

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node sistemde yoksa
npm install
cp .env.example .env.local                   # değerleri doldurun
```

1. **Supabase projesi A** oluşturun ve migration'ları uygulayın: `supabase link` ardından `supabase db push`
   (ya da `supabase/migrations/*.sql` dosyalarını sırayla SQL Editor'de çalıştırın).
2. **control_api rolüne parola verin** (SQL Editor):
   `alter role control_api with login password '<güçlü-parola>';`
   `CONTROL_DATABASE_URL` değerini pooler adresiyle doldurun (kullanıcı adı `control_api.<proje-ref>`).
3. **Ortak sırrı üretin:** `openssl rand -hex 32` → bu repoda `CONTROL_HMAC_SECRET`. Aynı değeri
   `ar-control` reposunda da kullanın.
4. **Auth:** Supabase → Authentication → URL Configuration: Site URL = `NEXT_PUBLIC_SITE_URL`,
   Redirect URL'lere `<site>/auth/callback` ekleyin. Minimum şifre uzunluğunu 10 yapın.
5. **Vercel:** Projeye bir Edge Config bağlayın (`EDGE_CONFIG` otomatik eklenir). Yazma için
   `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN` (ve takım kullanıyorsanız `VERCEL_TEAM_ID`) ekleyin. İsteğe
   bağlı: `CONTROL_ALLOWED_IPS` ile iç API'yi yalnız Sistem 2'nin IP'lerine açın.
6. `npm run dev` → http://localhost:3000

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | İmza birim testleri + veritabanı testleri (gömülü Postgres, Docker gerekmez) |
| `npm run typecheck` / `npm run lint` / `npm run build` | Tip kontrolü / lint / üretim derlemesi |

Veritabanı testleri migration'ları gerçek bir Postgres'e (PGlite) uygular ve şunları doğrular:
işletmeler arası izolasyon, anon'un tablolara erişememesi, şube fiyatı, analitik, `control_api`
rolünün yalnızca kontrol fonksiyonlarını çalıştırabilmesi, nonce replay koruması, **askıya alınınca
tüm veri yollarının kesilmesi**, idempotentlik ve tekrar açınca verilerin aynen geri gelmesi.

## İç API sözleşmesi (Sistem 2 ile birebir aynı olmalı)

```
x-ctl-timestamp: <unix saniye>          (±60 sn)
x-ctl-nonce:     <uuid>                 (tek kullanımlık)
x-ctl-signature: hex(HMAC-SHA256(secret, `${timestamp}.${nonce}.${METHOD}.${path}.${sha256hex(body)}`))
```
