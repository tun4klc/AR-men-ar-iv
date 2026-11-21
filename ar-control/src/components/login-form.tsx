"use client";

import { useActionState } from "react";
import type { LoginState } from "@/lib/login-actions";

export function LoginForm({ step, action }: { step: "password" | "totp"; action: (s: LoginState, f: FormData) => Promise<LoginState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand">Kontrol Merkezi</p>
      <h1 className="mb-6 text-2xl font-bold">{step === "password" ? "Giriş" : "İki adımlı doğrulama"}</h1>
      <form action={formAction} className="flex flex-col gap-4">
        {step === "password" ? (
          <>
            <div><label className="label" htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" autoComplete="username" required className="input" /></div>
            <div><label className="label" htmlFor="password">Şifre</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
          </>
        ) : (
          <div><label className="label" htmlFor="code">Doğrulayıcı uygulamadaki 6 haneli kod</label>
            <input id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required autoFocus
              className="input text-center text-2xl tracking-[0.5em]" /></div>
        )}
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className="btn-primary py-2.5">{pending ? "Kontrol ediliyor…" : "Devam"}</button>
      </form>
    </main>
  );
}
