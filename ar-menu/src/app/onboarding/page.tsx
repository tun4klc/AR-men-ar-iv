"use client";

import { useActionState } from "react";
import { createTenant } from "./actions";

export default function Onboarding() {
  const [state, action, pending] = useActionState(createTenant, undefined);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">İşletmenizi oluşturun</h1>
      <p className="mb-6 mt-1 text-muted">Diğer şubeleri daha sonra panelden ekleyebilirsiniz.</p>
      <form action={action} className="flex flex-col gap-4">
        <div><label className="label" htmlFor="name">İşletme adı</label>
          <input id="name" name="name" required className="input" placeholder="Örn. Bravo Bistro" /></div>
        <div><label className="label" htmlFor="branch">İlk şube adı</label>
          <input id="branch" name="branch" required className="input" placeholder="Örn. Kadıköy" /></div>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className="btn-primary py-2.5">{pending ? "Oluşturuluyor…" : "Devam et"}</button>
      </form>
    </main>
  );
}
