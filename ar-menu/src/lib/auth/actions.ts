"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-next";

export type FormState = { error?: string; message?: string } | undefined;

const Credentials = z.object({
  email: z.email("Geçerli bir e-posta girin."),
  password: z.string().min(10, "Şifre en az 10 karakter olmalı.")
    .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, "Şifre en az bir harf içermeli.")
    .regex(/\d/, "Şifre en az bir rakam içermeli."),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Hesabın var olup olmadığını açığa çıkarmayan tek tip mesaj.
  if (error) return { error: "E-posta veya şifre hatalı." };
  redirect(safeNextPath(form.get("next")));
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl()}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: "Kayıt tamamlanamadı. Lütfen tekrar deneyin." };
  if (data.session) redirect("/onboarding");
  return { message: "E-postanıza bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayarak devam edin." };
}

export async function logout() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
