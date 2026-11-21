import { test } from "node:test";
import assert from "node:assert/strict";
import { localized, parseAcceptLanguage, pickLang, planTranslation } from "../src/lib/menu-i18n.ts";

test("telefon dili algılanır, desteklenmeyen dilde İngilizce", () => {
  assert.equal(pickLang(parseAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")), "de");
  assert.equal(pickLang(parseAcceptLanguage("ar-SA,ar;q=0.9")), "ar");
  assert.equal(pickLang(parseAcceptLanguage("ru")), "ru");
  assert.equal(pickLang(parseAcceptLanguage("fr-FR,fr;q=0.9")), "en");
  assert.equal(pickLang(parseAcceptLanguage("fr;q=0.9,tr;q=1")), "tr");
  assert.equal(pickLang(parseAcceptLanguage("")), "tr");
});

test("boş alan çevrilir, elle yazılan korunur", () => {
  assert.deepEqual(planTranslation({ trChanged: false, hasDescription: true, submitted: { name: "", description: "" } }),
    { name: true, description: true });
  assert.deepEqual(planTranslation({ trChanged: false, hasDescription: true,
    previous: { name: "Torte", description: "süß" }, submitted: { name: "Torte", description: "süß" } }),
    { name: false, description: false });
});

test("Türkçe değişince dokunulmamış çeviri yenilenir, elle değiştirilen korunur", () => {
  const previous = { name: "Torte", description: "süß" };
  assert.deepEqual(planTranslation({ trChanged: true, hasDescription: true, previous, submitted: previous }),
    { name: true, description: true });
  assert.deepEqual(planTranslation({ trChanged: true, hasDescription: true, previous, submitted: { name: "Erdbeertorte", description: "süß" } }),
    { name: false, description: true });
});

test("Türkçe açıklama yoksa açıklama çevrilmez; zorla yeniden çevirme", () => {
  assert.equal(planTranslation({ trChanged: false, hasDescription: false, submitted: { name: "x" } }).description, false);
  assert.deepEqual(planTranslation({ trChanged: false, hasDescription: true, force: true,
    previous: { name: "a", description: "b" }, submitted: { name: "a", description: "b" } }), { name: true, description: true });
});

test("dil yoksa İngilizce, o da yoksa Türkçe gösterilir", () => {
  const p = { name_tr: "Pasta", name_en: "Cake", description_tr: "tatlı", description_en: null,
    translations: { de: { name: "Torte", description: null } } };
  assert.deepEqual(localized(p, "de"), { name: "Torte", description: "tatlı" });
  assert.deepEqual(localized(p, "ru"), { name: "Cake", description: "tatlı" });
  assert.deepEqual(localized({ name_tr: "Pasta" }, "ar"), { name: "Pasta", description: null });
});
