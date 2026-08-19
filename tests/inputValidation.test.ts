import assert from "node:assert/strict";
import test from "node:test";
import { cleanText, httpUrl, optionalCleanText, plainObject } from "../lib/inputValidation";

test("acepta solamente objetos JSON planos", () => {
  assert.deepEqual(plainObject({ name: "Centro" }), { name: "Centro" });
  assert.equal(plainObject([]), null);
  assert.equal(plainObject(null), null);
});

test("limpia texto y aplica longitud y patrón", () => {
  assert.equal(cleanText("  ABC-1  ", { min: 2, max: 10, pattern: /^[A-Z0-9-]+$/ }), "ABC-1");
  assert.equal(cleanText("<script>", { max: 5 }), null);
  assert.equal(optionalCleanText("", 20), null);
});

test("solo admite endpoints HTTPS", () => {
  assert.equal(httpUrl("https://push.example/subscription"), "https://push.example/subscription");
  assert.equal(httpUrl("http://push.example/subscription"), null);
  assert.equal(httpUrl("javascript:alert(1)"), null);
});
