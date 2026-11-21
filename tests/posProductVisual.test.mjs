import test from "node:test";
import assert from "node:assert/strict";
import {
  getProductVisual,
  DEFAULT_PRODUCT_COLOR,
  DEFAULT_PRODUCT_IMAGES,
} from "../lib/pos/productVisual.ts";

test("getProductVisual resolves explicit relative images in public folder", () => {
  const visual = getProductVisual("/tequilitros/productos/paloma.png");
  assert.equal(visual.type, "image");
  assert.equal(visual.url, "/tequilitros/productos/paloma.png");
});

test("getProductVisual resolves external http/https images", () => {
  const visual = getProductVisual("https://example.com/drink.jpg");
  assert.equal(visual.type, "image");
  assert.equal(visual.url, "https://example.com/drink.jpg");
});

test("getProductVisual falls back to official drink image when productName is recognized", () => {
  // If icon is null or default hex, but product name is "Paloma"
  const paloma = getProductVisual(null, "Paloma");
  assert.equal(paloma.type, "image");
  assert.equal(paloma.url, "/tequilitros/productos/paloma.png");

  // Vampiro
  const vampiro = getProductVisual("#EF4444", "Vampiro");
  assert.equal(vampiro.type, "image");
  assert.equal(vampiro.url, "/tequilitros/productos/vampiro.png");

  // Cantarito
  const cantarito = getProductVisual("", "Cantarito");
  assert.equal(cantarito.type, "image");
  assert.equal(cantarito.url, "/tequilitros/productos/cantarito.png");

  // Tequimiche
  const tequimiche = getProductVisual(undefined, "Tequimiche");
  assert.equal(tequimiche.type, "image");
  assert.equal(tequimiche.url, "/tequilitros/productos/tequimiche.png");

  // Tequimojito
  const tequimojito = getProductVisual(null, "Tequimojito");
  assert.equal(tequimojito.type, "image");
  assert.equal(tequimojito.url, "/tequilitros/productos/tequimojito.png");

  // Tequimora
  const tequimora = getProductVisual(null, "Tequimora");
  assert.equal(tequimora.type, "image");
  assert.equal(tequimora.url, "/tequilitros/productos/tequimora.png");

  // Blanco
  const blanco = getProductVisual(null, "Blanco");
  assert.equal(blanco.type, "image");
  assert.equal(blanco.url, "/tequilitros/blanco.jpg");

  // Reposado
  const reposado = getProductVisual(null, "Reposado");
  assert.equal(reposado.type, "image");
  assert.equal(reposado.url, "/tequilitros/reposado.jpg");

  // Zarzamora
  const zarzamora = getProductVisual(null, "Zarzamora");
  assert.equal(zarzamora.type, "image");
  assert.equal(zarzamora.url, "/tequilitros/zarzamora.jpg");
});

test("getProductVisual retains custom hex colors when productName is not in official catalog", () => {
  const custom = getProductVisual("#3B82F6", "Bebida Especial de la Casa");
  assert.equal(custom.type, "color");
  assert.equal(custom.hex, "#3B82F6");
});

test("getProductVisual falls back to DEFAULT_PRODUCT_COLOR for unknown items without visual", () => {
  const unknown = getProductVisual(null, "Cacahuates");
  assert.equal(unknown.type, "color");
  assert.equal(unknown.hex, DEFAULT_PRODUCT_COLOR);
});
