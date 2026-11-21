import "server-only";

export type Mail = { to: string[]; subject: string; html: string; text: string };
export type MailResult = "sent" | "skipped" | "failed";

/**
 * İşlem e-postası gönderir (Resend REST API).
 * RESEND_API_KEY veya MAIL_FROM tanımlı değilse gönderim atlanır ("skipped").
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || mail.to.length === 0) return "skipped";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(process.env.SUPPORT_EMAIL ? { reply_to: process.env.SUPPORT_EMAIL } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`mail.send_failed (${res.status}):`, (await res.text().catch(() => "")).slice(0, 300));
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error("mail.send_failed:", err);
    return "failed";
  }
}
