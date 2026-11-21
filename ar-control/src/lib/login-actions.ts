"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { db } from "./db";
import { audit } from "./auth";
import { MFA_COOKIE, SESSION_COOKIE, signSession, verifySession } from "./session-token";

export type LoginState = { error?: string } | undefined;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 8;
// Zamanlama saldırısıyla e-posta tespitini önlemek için var olmayan kullanıcıda da hash karşılaştırılır.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("dummy-password-for-timing", 12));

const cookieOpts = (maxAge: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge,
});

const GENERIC = "E-posta, şifre veya doğrulama kodu hatalı.";

async function registerFailure(id: string, email: string) {
  const [r] = await db()`
    update public.admins set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= ${MAX_ATTEMPTS}
                          then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
    where id = ${id} returning failed_attempts`;
  await audit({ adminId: id, adminEmail: email, action: r.failed_attempts >= MAX_ATTEMPTS ? "login_locked" : "login_failed" });
}

export async function loginPassword(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);

  const [admin] = await db()`
    select id, email, password_hash, is_active, locked_until, session_version from public.admins where email = ${email}`;
  const ok = await bcrypt.compare(password, admin?.password_hash ?? getDummyHash());

  if (!admin || !admin.is_active) {
    await audit({ adminEmail: email, action: "login_failed" });
    return { error: GENERIC };
  }
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return { error: `Çok fazla hatalı deneme. ${LOCK_MINUTES} dakika sonra tekrar deneyin.` };
  }
  if (!ok) {
    await registerFailure(admin.id, admin.email);
    return { error: GENERIC };
  }

  (await cookies()).set(MFA_COOKIE, await signSession({ sub: admin.id, stage: "mfa", sv: admin.session_version }, 300), cookieOpts(300));
  redirect("/login/2fa");
}

export async function loginTotp(_: LoginState, form: FormData): Promise<LoginState> {
  const store = await cookies();
  const claims = await verifySession(store.get(MFA_COOKIE)?.value, "mfa");
  if (!claims) redirect("/login");

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const [admin] = await db()`
    select id, email, totp_secret, is_active, locked_until, last_totp_step, session_version
    from public.admins where id = ${claims.sub}`;
  if (!admin?.is_active || admin.session_version !== claims.sv) redirect("/login");
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return { error: `Çok fazla hatalı deneme. ${LOCK_MINUTES} dakika sonra tekrar deneyin.` };
  }

  // ±1 adım (30 sn) saat kaymasına izin ver; eşleşen adımı bul.
  authenticator.options = { window: 1 };
  const delta = /^\d{6}$/.test(code) ? authenticator.checkDelta(code, admin.totp_secret) : null;
  const step = Math.floor(Date.now() / 30_000) + (delta ?? 0);
  // Aynı (veya daha eski) adımın kodu ikinci kez kabul edilmez → yakalanan kod tekrar kullanılamaz.
  const reused = admin.last_totp_step !== null && step <= Number(admin.last_totp_step);
  const valid = delta !== null && delta !== undefined;
  if (!valid || reused) {
    await registerFailure(admin.id, admin.email);
    return { error: GENERIC };
  }

  await db()`
    update public.admins set failed_attempts = 0, locked_until = null, last_totp_step = ${step}, last_login_at = now()
    where id = ${admin.id}`;
  await audit({ adminId: admin.id, adminEmail: admin.email, action: "login" });

  store.delete(MFA_COOKIE);
  store.set(SESSION_COOKIE, await signSession({ sub: admin.id, stage: "full", sv: admin.session_version }, SESSION_HOURS * 3600),
    cookieOpts(SESSION_HOURS * 3600));
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value, "full");
  if (claims) {
    // Tüm cihazlardaki oturumları düşür.
    await db()`update public.admins set session_version = session_version + 1 where id = ${claims.sub}`;
    await audit({ adminId: claims.sub, action: "logout" });
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
