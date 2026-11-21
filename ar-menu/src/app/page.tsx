import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">AR Menü</p>
      <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
        Yemeğiniz masaya gelmeden, masada görünsün.
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Misafirleriniz QR kodu okutur, menüyü açar ve tabağı gerçek boyutunda, 3D olarak masasında görür.
        Siz de hangi ürünün en çok ilgi gördüğünü şube şube izlersiniz.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/register" className="btn-primary">İşletmenizi kaydedin</Link>
        <Link href="/login" className="btn-ghost">Giriş yap</Link>
      </div>
    </main>
  );
}
