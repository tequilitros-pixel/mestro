import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const saleRoute = readFileSync("app/api/pos/sales/route.ts", "utf8");
const tablesPage = readFileSync("app/pospress/tables/page.tsx", "utf8");
const pendingTabsPage = readFileSync("app/pospress/pending-tabs/page.tsx", "utf8");
const pospressPage = readFileSync("app/pospress/page.tsx", "utf8");
const transactionsPage = readFileSync("app/pospress/transactions/page.tsx", "utf8");

test("POSPress usa el corte abierto autorizado como frontera de sucursal", () => {
  for (const source of [tablesPage, pendingTabsPage, pospressPage]) {
    assert.match(source, /getCurrentPospressCashCut/);
    assert.match(source, /id: currentCashCut\.branch\.id/);
    assert.match(source, /openCashCutId: currentCashCut\?\.branch\.id ===/);
  }
  assert.match(transactionsPage, /branchId: currentCashCut\.branch\.id, cashCutId: currentCashCut\.id/);
});

test("la API rechaza cobros fuera de la sucursal o del corte actual", () => {
  assert.match(saleRoute, /branchId !== currentCashCut\.branch\.id/);
  assert.match(saleRoute, /!cashCutId \|\| cashCutId !== currentCashCut\.id/);
  assert.match(saleRoute, /existing\.cashCutId !== currentCashCut\.id/);
});
