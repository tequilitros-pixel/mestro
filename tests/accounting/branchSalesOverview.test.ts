import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBranchSales } from "../../lib/accounting/branchSalesSummary";

test("el resumen de ventas de sucursal agrupa productos, pagos y días operativos", () => {
  const overview = summarizeBranchSales([
    {
      total: 300,
      createdAt: new Date("2026-10-05T18:00:00.000Z"),
      payments: [{ method: "EFECTIVO", amount: 100 }, { method: "TARJETA", amount: 200 }],
      items: [
        { name: "Paloma", quantity: 2, lineTotal: 200, isCustom: false, variant: { product: { id: "paloma", name: "Paloma" } } },
        { name: "Cobro personalizado", quantity: 1, lineTotal: 100, isCustom: true, variant: null },
      ],
    },
    {
      total: 150,
      createdAt: new Date("2026-10-05T22:00:00.000Z"),
      payments: [{ method: "EFECTIVO", amount: 150 }],
      items: [{ name: "Paloma especial", quantity: 1, lineTotal: 150, isCustom: false, variant: { product: { id: "paloma", name: "Paloma" } } }],
    },
  ]);

  assert.equal(overview.total, 450);
  assert.equal(overview.saleCount, 2);
  assert.equal(overview.averageTicket, 225);
  assert.equal(overview.units, 3);
  assert.deepEqual(overview.products, [{ key: "paloma", name: "Paloma", units: 3, total: 350 }]);
  assert.deepEqual(overview.payments, [
    { method: "EFECTIVO", label: "Efectivo", amount: 250 },
    { method: "TARJETA", label: "Tarjeta", amount: 200 },
  ]);
  assert.deepEqual(overview.daily.map(({ date, total, saleCount }) => ({ date, total, saleCount })), [
    { date: "2026-10-05", total: 450, saleCount: 2 },
  ]);
});
