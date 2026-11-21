# AR Menü Sistemi

Bu klasörde birbirinden ayrı çalışan iki sistemin tüm kaynak dosyaları var.

| Klasör | Sistem | Kimin için | Yerel adres |
|---|---|---|---|
| `ar-menu` | Menü Platformu | Restoranlar ve müşterileri (QR menü, AR, işletme paneli) | http://localhost:3000 |
| `ar-control` | Kontrol Merkezi | Yalnızca siz (işletme listesi, tek tıkla kapat/aç) | http://localhost:3100 |

Ayrıntılı kurulum için her klasörün kendi `README.md` dosyasına bakın.

## Çalıştırma

İlk seferde her klasörde bağımlılıkları kurun (`node_modules` boyut nedeniyle kopyalanmadı):

```bash
cd ~/Desktop/AR-Menu-Sistemi/ar-menu && PATH="$HOME/.local/node/bin:$PATH" npm install
cd ~/Desktop/AR-Menu-Sistemi/ar-control && PATH="$HOME/.local/node/bin:$PATH" npm install
```

Sonra iki ayrı terminalde:

```bash
cd ~/Desktop/AR-Menu-Sistemi/ar-menu && PATH="$HOME/.local/node/bin:$PATH" npm run dev
cd ~/Desktop/AR-Menu-Sistemi/ar-control && PATH="$HOME/.local/node/bin:$PATH" npm run dev
```

## Önemli

- `.env.local` dosyaları veritabanı parolalarını ve gizli anahtarları içerir. Bu klasörü kimseyle paylaşmayın, buluta veya GitHub'a yüklemeyin.
- Veriler (menüler, işletmeler, yöneticiler) bu klasörde değil, Supabase'te durur:
  - Menü Platformu → `ar-menu-platform` projesi
  - Kontrol Merkezi → `ar-control-center` projesi
- Kontrol Merkezi canlıda: https://ar-control-center.vercel.app (internet bağlantınız vercel.app adreslerini engelliyorsa VPN gerekir).
