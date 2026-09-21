import assert from "node:assert/strict";
import test from "node:test";
import { aggregateProductSales } from "../../lib/pos/salesAnalytics";

test("Productos cuenta unidades de catálogo y excluye cobros personalizados", () => {
  const products = aggregateProductSales([
    {
      items: [
        {
          name: "Paloma (Grande)",
          quantity: 2,
          lineTotal: 198,
          isCustom: false,
          productId: "paloma",
          productName: "Paloma",
        },
        {
          name: "2 rondas de 4x100 y una bebida",
          quantity: 1,
          lineTotal: 299,
          isCustom: true,
          productId: null,
          productName: null,
        },
      ],
    },
    {
      items: [
        {
          name: "Paloma (Chica)",
          quantity: 3,
          lineTotal: 210,
          isCustom: false,
          productId: "paloma",
          productName: "Paloma",
        },
        {
          name: "Vampiro",
          quantity: 4,
          lineTotal: 396,
          isCustom: false,
          productId: "vampiro",
          productName: "Vampiro",
        },
      ],
    },
  ]);

  assert.deepEqual(products, [
    { key: "paloma", name: "Paloma", units: 5, total: 408 },
    { key: "vampiro", name: "Vampiro", units: 4, total: 396 },
  ]);
});

test("Productos conserva líneas históricas no personalizadas sin relación de catálogo", () => {
  const products = aggregateProductSales([
    {
      items: [
        {
          name: "Producto retirado",
          quantity: 2,
          lineTotal: 100,
          isCustom: false,
          productId: null,
          productName: null,
        },
      ],
    },
  ]);

  assert.deepEqual(products, [
    {
      key: "snapshot:Producto retirado",
      name: "Producto retirado",
      units: 2,
      total: 100,
    },
  ]);
});
