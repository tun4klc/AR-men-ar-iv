export function SuspendedNotice({ forOwner = false }: { forOwner?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">Hizmet dışı</div>
      <h1 className="text-2xl font-bold">
        {forOwner ? "İşletme hesabınız askıya alındı" : "Bu menü geçici olarak kullanılamıyor"}
      </h1>
      <p className="text-muted">
        {forOwner
          ? "Menünüz ve paneliniz şu anda kapalı. Verileriniz silinmedi; hesap yeniden açıldığında her şey olduğu gibi geri gelir. Destek için platform yöneticisiyle iletişime geçin."
          : "İşletmenin dijital menü hizmeti şu anda durdurulmuş durumda. Lütfen siparişiniz için personelden yardım isteyin."}
      </p>
    </main>
  );
}
