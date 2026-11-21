"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";

export function AuthForm({
  mode, action, next,
}: { mode: "login" | "register"; action: (s: FormState, f: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isLogin = mode === "login";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-bold">{isLogin ? "İşletme paneline giriş" : "İşletmenizi kaydedin"}</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <div><label className="label" htmlFor="email">E-posta</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Şifre</label>
          <input id="password" name="password" type="password" required minLength={isLogin ? 1 : 10}
            autoComplete={isLogin ? "current-password" : "new-password"} className="input" />
          {!isLogin && <p className="mt-1 text-xs text-muted">En az 10 karakter, harf ve rakam.</p>}</div>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
        <button disabled={pending} className="btn-primary py-2.5">{pending ? "Lütfen bekleyin…" : isLogin ? "Giriş yap" : "Hesap oluştur"}</button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {isLogin ? <>Hesabınız yok mu? <Link className="text-brand underline" href="/register">Kayıt olun</Link></>
          : <>Zaten hesabınız var mı? <Link className="text-brand underline" href="/login">Giriş yapın</Link></>}
      </p>
    </main>
  );
}
