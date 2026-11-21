# Kontrol Merkezi — Sistem 2

Platform sahibinin özel paneli. Sistemi kullanan tüm işletmeleri kullanıma göre sıralar ve bir
işletmenin menü sitesini **tek tıkla kapatır / tek tıkla geri açar**. Veri silinmez.

**Tamamen ayrı bir sistemdir:**

- Farklı kök alan adında çalışır (ör. `xyz-panel.net`). Menü alan adıyla bağı yoktur ve arama
  motorlarına kapalıdır (`noindex` başlığı + `robots.txt`).
- Ayrı hosting hesabında ve **kendi veritabanında** çalışır (yalnız yöneticiler, 2FA ve denetim kaydı).
- Menü Platformu'nun veritabanına **bağlanmaz**, onun anahtarlarını tutmaz. Yalnızca imzalı iç API'sini
  çağırır: `GET /api/control/tenants`, `POST /api/control/tenants/<id>/suspend|activate`.

## Güvenlik

- Kayıt sayfası yoktur. Yöneticiler yalnızca `npm run create-admin` komutuyla eklenir.
- Giriş: e-posta + şifre (bcrypt) + **zorunlu TOTP 2FA**. Aynı kod ikinci kez kabul edilmez.
  5 hatalı denemede hesap 15 dakika kilitlenir.
- Oturum: `httpOnly`, `secure`, `SameSite=Strict`, 8 saat geçerli, imzalı çerez. Çıkış tüm
  cihazlardaki oturumları düşürür.
- İsteğe bağlı `ADMIN_ALLOWED_IPS`: liste dışındaki IP'lere panel 404 döner.
- Her aç/kapat işlemi önce "beklemede" olarak denetim kaydına yazılır, sonra Sistem 1'in yanıtı
  işlenir. Sistem 1 onaylamazsa anahtar eski haline döner ve "uygulanmadı" denir.
- Sistem 1'e ulaşılamazsa panel son bilinen listeyi kırmızı uyarıyla gösterir ve anahtarlar kilitlenir.

## Kurulum

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node sistemde yoksa
npm install
cp .env.example .env.local
```

1. **Ayrı bir veritabanı** oluşturun (ör. yeni bir Supabase projesi B). Menü Platformu'nunkini
   kullanmayın. `supabase/migrations/` içindeki SQL'i çalıştırın, `DATABASE_URL` değerini girin.
2. `SESSION_SECRET` değerini `openssl rand -hex 32` ile üretin. Bu sır yalnız bu sistemde kalır.
3. `MENU_API_BASE_URL` olarak Menü Platformu'nun adresini, `CONTROL_HMAC_SECRET` olarak ise
   Menü Platformu'ndaki **aynı** değeri girin.
4. İlk yöneticiyi oluşturun:

   ```bash
   DATABASE_URL=... npm run create-admin -- siz@ornek.com
   ```

   Komut şifreyi bir kez gösterir ve terminalde 2FA QR kodunu basar.
5. Yerelde çalıştırma: `npm run dev` → http://localhost:3100. Yayına alırken **ayrı bir Vercel hesabı
   veya takımı** ve ayrı bir alan adı kullanın.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (port 3100) |
| `npm test` | İmza sözleşmesi + şema testleri |
| `npm run typecheck` / `npm run lint` / `npm run build` | Tip kontrolü / lint / üretim derlemesi |
| `npm run create-admin -- <e-posta>` | Yönetici + 2FA oluşturur |
