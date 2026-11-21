import { test } from "node:test";
import assert from "node:assert/strict";
import { suspensionEmail } from "../src/lib/control/suspension-email.ts";

test("askı e-postası: işletme adı ve gerekçe yer alır", () => {
  const m = suspensionEmail({ tenantName: "Bravo Bistro", reason: "Ödeme yapılmadı", supportEmail: "destek@armenu.com" });
  assert.equal(m.subject, "Bravo Bistro menü hizmetiniz durduruldu");
  assert.match(m.text, /Gerekçe: Ödeme yapılmadı/);
  assert.match(m.text, /silinmedi/);
  assert.match(m.html, /mailto:destek@armenu\.com/);
});

test("askı e-postası: HTML kaçışı yapılır", () => {
  const m = suspensionEmail({ tenantName: "<b>Kötü</b> & Co", reason: `"><script>alert(1)</script>` });
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.html, /&lt;b&gt;Kötü&lt;\/b&gt; &amp; Co/);
  assert.doesNotMatch(m.html, /mailto:/); // destek adresi yoksa bağlantı da yok
});
