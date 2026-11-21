#!/usr/bin/env node
// Kontrol Merkezi'ne yönetici ekler. Panelden kayıt yoktur; yöneticiler yalnızca bu komutla oluşturulur.
// Kullanım: DATABASE_URL=... node scripts/create-admin.mjs ornek@alan.com
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Kullanım: node scripts/create-admin.mjs <e-posta>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const password = randomBytes(18).toString("base64url");
const secret = authenticator.generateSecret();
const hash = await bcrypt.hash(password, 12);

try {
  await sql`insert into public.admins (email, password_hash, totp_secret) values (${email}, ${hash}, ${secret})`;
} catch (e) {
  console.error(e.code === "23505" ? "Bu e-postayla bir yönetici zaten var." : `Hata: ${e.message}`);
  process.exit(1);
} finally {
  await sql.end();
}

const uri = authenticator.keyuri(email, "Kontrol Merkezi", secret);
console.log(`\nYönetici oluşturuldu: ${email}`);
console.log(`Şifre (yalnızca şimdi gösterilir, güvenli bir yere kaydedin): ${password}\n`);
console.log("Google Authenticator / 1Password / Authy ile bu QR kodu okutun:\n");
console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
console.log(`QR okutulamıyorsa elle girin: ${secret}\n`);
