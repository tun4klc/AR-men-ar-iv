/** İşletme askıya alındığında sahibine giden e-postanın içeriği (saf fonksiyon, test edilebilir). */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function suspensionEmail(input: { tenantName: string; reason: string; supportEmail?: string | null }) {
  const name = input.tenantName.trim();
  const reason = input.reason.trim();
  const support = input.supportEmail?.trim() || null;

  const subject = `${name} menü hizmetiniz durduruldu`;

  const text = [
    "Merhaba,",
    "",
    `${name} işletmenizin AR Menü hizmeti durdurulmuştur.`,
    "Müşterileriniz QR kodu okuttuğunda menü yerine \"Hizmet durduruldu\" sayfasını görecek, işletme paneline de geçici olarak erişilemeyecektir.",
    "",
    `Gerekçe: ${reason}`,
    "",
    "Menünüz, fotoğraflarınız, 3D modelleriniz ve QR kodlarınız silinmedi. Hizmet yeniden açıldığında her şey olduğu gibi geri gelir.",
    support ? `Sorularınız için bu e-postayı yanıtlayabilir ya da ${support} adresine yazabilirsiniz.` : "Sorularınız için bu e-postayı yanıtlayabilirsiniz.",
    "",
    "AR Menü",
  ].join("\n");

  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f6f3ef;font-family:Arial,Helvetica,sans-serif;color:#1d120c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<h1 style="font-size:20px;margin:0 0 16px">Menü hizmetiniz durduruldu</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Merhaba,</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px"><strong>${escapeHtml(name)}</strong> işletmenizin AR Menü hizmeti durdurulmuştur. Müşterileriniz QR kodu okuttuğunda menü yerine “Hizmet durduruldu” sayfasını görecek, işletme paneline de geçici olarak erişilemeyecektir.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px;padding:12px 14px;background:#f6f3ef;border-radius:8px"><strong>Gerekçe:</strong> ${escapeHtml(reason)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Menünüz, fotoğraflarınız, 3D modelleriniz ve QR kodlarınız <strong>silinmedi</strong>. Hizmet yeniden açıldığında her şey olduğu gibi geri gelir.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px">${support
    ? `Sorularınız için bu e-postayı yanıtlayabilir ya da <a href="mailto:${escapeHtml(support)}" style="color:#8a4b22">${escapeHtml(support)}</a> adresine yazabilirsiniz.`
    : "Sorularınız için bu e-postayı yanıtlayabilirsiniz."}</p>
<p style="font-size:13px;color:#7a6a60;margin:0">AR Menü</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, text, html };
}
