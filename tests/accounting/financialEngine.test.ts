import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateIngredientCost,
  resolveIngredientBaseCost,
  isWasteMovement,
  isRentExpense,
  generateCostAlerts,
  computeBranchFinancialMetrics,
  computeCompanyConsolidatedMetrics,
  money,
  percent,
} from "../../lib/accounting/financialEngine";

test("conversión robusta de recetas: unidad base calcula dosis exacta sin inflar costo por botella (evita 45 ml * botella)", () => {
  // Caso crítico de bar: botella de Mezcal $300 de 750 ml, receta usa 45 ml, con unitStatus UNRESOLVED
  const mezcalIngredient = {
    quantity: 45,
    unit: "ML",
    unitStatus: "UNRESOLVED",
    inventoryProduct: {
      unitCost: 300,
      inventoryBaseUnit: "ML",
      normalizedContentPerUnit: 750,
    },
  };

  const costResult = calculateIngredientCost(mezcalIngredient);
  assert.equal(costResult.unitCostPerBaseUnit, 0.4); // $300 / 750 ml = $0.40 / ml
  assert.equal(costResult.cost, 18); // 45 ml * $0.40 = $18.00 (NO 45 * 300 = $13,500)
});

test("conversión robusta de recetas: cocina con gramos y presentaciones por kilo", () => {
  // Caso cocina: bolsa de carne $180 de 1000 g, porción de 250 g
  const meatIngredient = {
    quantity: 250,
    unit: "G",
    unitStatus: "RESOLVED",
    inventoryProduct: {
      unitCost: 180,
      inventoryBaseUnit: "G",
      normalizedContentPerUnit: 1000,
    },
  };

  const costResult = calculateIngredientCost(meatIngredient);
  assert.equal(costResult.unitCostPerBaseUnit, 0.18);
  assert.equal(costResult.cost, 45); // 250 g * $0.18 = $45.00
});

test("receta sin costo configurado reporta costo nulo para advertir valuación parcial", () => {
  const unpricedIngredient = {
    quantity: 30,
    unit: "ML",
    inventoryProduct: {
      unitCost: null,
      inventoryBaseUnit: "ML",
      normalizedContentPerUnit: 750,
    },
  };

  const costResult = calculateIngredientCost(unpricedIngredient);
  assert.equal(costResult.cost, null);
  assert.equal(costResult.unitCostPerBaseUnit, null);
  assert.equal(costResult.quantity, 30);
});

test("identificación de movimientos de merma, fuga y ajustes operativos", () => {
  // Movimientos de merma explícita
  assert.equal(isWasteMovement({ reasonCode: "WASTE" }), true);
  assert.equal(isWasteMovement({ reasonCode: "AUDIT_DISCREPANCY" }), true);
  assert.equal(isWasteMovement({ reasonCode: "INTERNAL_USE" }), true);
  assert.equal(isWasteMovement({ reasonCode: "DAMAGED" }), true);
  assert.equal(isWasteMovement({ reasonCode: "MERMA_BARRA" }), true);
  assert.equal(isWasteMovement({ reasonCode: "DISCARD" }), true);

  // Ajuste de salida de inventario
  assert.equal(isWasteMovement({ movementType: "ADJUSTMENT_OUT", reasonCode: "AJUSTE_MENSUAL" }), true);

  // Movimientos que NO son merma (consumo normal de venta, compra o traspaso)
  assert.equal(isWasteMovement({ movementType: "SALE_CONSUMPTION", reasonCode: "POS2_SALE" }), false);
  assert.equal(isWasteMovement({ movementType: "RECEIPT", reasonCode: "RECEPCION" }), false);
});

test("identificación unificada de gastos de renta y arrendamiento", () => {
  // Por código de categoría
  assert.equal(isRentExpense({ categoryCode: "CONT_RENTA" }), true);
  assert.equal(isRentExpense({ categoryCode: "PAGO_RENTA" }), true);
  assert.equal(isRentExpense({ categoryCode: "renta" }), true);

  // Por concepto en texto libre
  assert.equal(isRentExpense({ concept: "Pago de renta sucursal Roma Octubre" }), true);
  assert.equal(isRentExpense({ concept: "Arrendamiento local comercial mes en curso" }), true);

  // Por nombre de categoría
  assert.equal(isRentExpense({ categoryName: "Renta de Inmuebles", concept: "Mes 10" }), true);

  // No debe clasificar gastos operativos normales como renta
  assert.equal(isRentExpense({ categoryCode: "CONT_LUZ", concept: "CFE bimestre" }), false);
  assert.equal(isRentExpense({ categoryName: "Insumos", concept: "Compra de verdura y limones" }), false);
  assert.equal(isRentExpense({ categoryName: "Caja chica", concept: "Hielo de emergencia" }), false);
});

test("cálculo de métricas financieras de sucursal (P&L completo, COGS %, Nómina %, Merma $, Renta %, Utilidad)", () => {
  const metrics = computeBranchFinancialMetrics({
    branchId: "branch-roma",
    branchName: "Roma",
    sales: 100000,
    saleCount: 250,
    cogs: 28000, // 28%
    cogsKnown: true,
    theoreticalCogs: 25000, // Varianza = 3000
    theoreticalCogsKnown: true,
    wasteCost: 1500, // Merma explícita = 1500
    closedLaborCost: 20000,
    accruedLaborCost: 5000, // Total nómina = 25000 (25%)
    closedLaborHours: 160,
    accruedLaborHours: 40, // Total horas = 200
    rentCost: 10000, // 10%
    cashOutflows: 3000,
    accountingPayments: 4000,
    otherExpenses: 7000,
    periodDays: 30,
  });

  assert.equal(metrics.sales, 100000);
  assert.equal(metrics.saleCount, 250);
  assert.equal(metrics.cogs, 28000);
  assert.equal(metrics.cogsPercent, 28);
  assert.equal(metrics.theoreticalCogs, 25000);
  assert.equal(metrics.wasteCost, 1500);
  assert.equal(metrics.costVariance, 3000); // Dinero exacto de merma / fuga sobre receta

  assert.equal(metrics.laborCost, 25000);
  assert.equal(metrics.payroll, 25000);
  assert.equal(metrics.laborCostPercent, 25);
  assert.equal(metrics.laborHours, 200);
  assert.equal(metrics.salesPerLaborHour, 500); // $100,000 / 200 hrs = $500/hr

  assert.equal(metrics.rentCost, 10000);
  assert.equal(metrics.rentPercent, 10);
  assert.equal(metrics.hasRent, true);

  assert.equal(metrics.otherExpenses, 7000);

  // Total gastos = 28000 (COGS) + 25000 (Labor) + 10000 (Renta) + 7000 (Otros) = 70,000
  assert.equal(metrics.registeredExpenses, 70000);
  assert.equal(metrics.operatingIncome, 30000); // $100,000 - $70,000 = $30,000
  assert.equal(metrics.operatingMarginPercent, 30);
  assert.equal(metrics.registeredResult, 30000);

  // Compatibilidad con contratos existentes de contabilidad
  assert.equal(metrics.inventory.actualCost, 28000);
  assert.equal(metrics.inventory.theoreticalCost, 25000);
  assert.equal(metrics.inventory.wasteCost, 1500);
  assert.equal(metrics.inventory.variance, 3000);
  assert.equal(metrics.registeredResultComplete, true);
});

test("generación de alertas de sobrecosto en escenarios críticos", () => {
  // Sucursal con problemas: COGS excesivo (45%), Nómina desbordada (42%), Sin renta registrada en 30 días, Pérdida
  const alerts = generateCostAlerts({
    sales: 50000,
    cogsPercent: 45,
    wasteCost: 3500, // 7% de ventas
    costVariance: 4000,
    laborCostPercent: 42,
    rentCost: 0,
    rentPercent: 0,
    operatingIncome: -8000,
    operatingMarginPercent: -16,
    cogsKnown: false, // Insumos sin precio
    periodDays: 30,
  });

  const alertCodes = alerts.map((a) => a.code);

  assert.ok(alertCodes.includes("COGS_CRITICAL"), "Debe alertar COGS crítico > 42%");
  assert.ok(alertCodes.includes("WASTE_CRITICAL"), "Debe alertar merma crítica > 5%");
  assert.ok(alertCodes.includes("LABOR_CRITICAL"), "Debe alertar nómina crítica > 40%");
  assert.ok(alertCodes.includes("PRIME_COST_CRITICAL"), "Debe alertar costo primo crítico > 72%");
  assert.ok(alertCodes.includes("OPERATING_LOSS"), "Debe alertar pérdida operativa");
  assert.ok(alertCodes.includes("RENT_MISSING"), "Debe alertar falta de registro de renta en mes completo");
  assert.ok(alertCodes.includes("PENDING_UNIT_COSTS"), "Debe alertar insumos sin costo configurado");
});

test("consolidado multi-sucursal compara ramas y suma totales de toda la empresa", () => {
  const branch1 = computeBranchFinancialMetrics({
    branchId: "b1",
    branchName: "Roma",
    sales: 100000,
    saleCount: 200,
    cogs: 28000,
    cogsKnown: true,
    theoreticalCogs: 26000,
    theoreticalCogsKnown: true,
    wasteCost: 1000,
    closedLaborCost: 20000,
    accruedLaborCost: 0,
    closedLaborHours: 150,
    accruedLaborHours: 0,
    rentCost: 10000,
    cashOutflows: 2000,
    accountingPayments: 3000,
    otherExpenses: 5000,
  });

  const branch2 = computeBranchFinancialMetrics({
    branchId: "b2",
    branchName: "Condesa",
    sales: 50000,
    saleCount: 100,
    cogs: 18000,
    cogsKnown: true,
    theoreticalCogs: 15000,
    theoreticalCogsKnown: true,
    wasteCost: 2000,
    closedLaborCost: 12000,
    accruedLaborCost: 3000,
    closedLaborHours: 90,
    accruedLaborHours: 10,
    rentCost: 8000,
    cashOutflows: 1000,
    accountingPayments: 1000,
    otherExpenses: 2000,
  });

  const consolidated = computeCompanyConsolidatedMetrics([branch1, branch2]);

  assert.equal(consolidated.sales, 150000);
  assert.equal(consolidated.saleCount, 300);
  assert.equal(consolidated.cogs, 46000); // 28000 + 18000
  assert.equal(consolidated.theoreticalCogs, 41000); // 26000 + 15000
  assert.equal(consolidated.wasteCost, 3000); // 1000 + 2000
  assert.equal(consolidated.costVariance, 5000); // 46000 - 41000
  assert.equal(consolidated.cogsPercent, money((46000 / 150000) * 100)); // 30.67%

  assert.equal(consolidated.laborCost, 35000); // 20000 + 15000
  assert.equal(consolidated.laborHours, 250); // 150 + 100
  assert.equal(consolidated.laborCostPercent, money((35000 / 150000) * 100)); // 23.33%
  assert.equal(consolidated.salesPerLaborHour, 600); // $150,000 / 250 hrs

  assert.equal(consolidated.rentCost, 18000); // 10000 + 8000
  assert.equal(consolidated.rentPercent, 12);
  assert.equal(consolidated.hasRent, true);

  assert.equal(consolidated.otherExpenses, 7000); // 5000 + 2000

  // Total egresos = 46000 + 35000 + 18000 + 7000 = 106,000
  // Utilidad = 150,000 - 106,000 = 44,000
  assert.equal(consolidated.operatingIncome, 44000);
  assert.equal(consolidated.operatingMarginPercent, money((44000 / 150000) * 100)); // 29.33%
});

test("manejo seguro de periodos sin ventas (seguridad contra división entre cero)", () => {
  const zeroSales = computeBranchFinancialMetrics({
    branchId: "b0",
    branchName: "Apertura reciente",
    sales: 0,
    saleCount: 0,
    cogs: 0,
    cogsKnown: true,
    theoreticalCogs: 0,
    theoreticalCogsKnown: true,
    wasteCost: 0,
    closedLaborCost: 5000,
    accruedLaborCost: 0,
    closedLaborHours: 40,
    accruedLaborHours: 0,
    rentCost: 12000,
    cashOutflows: 0,
    accountingPayments: 0,
    otherExpenses: 1000,
    periodDays: 7,
  });

  assert.equal(zeroSales.sales, 0);
  assert.equal(zeroSales.cogsPercent, 0);
  assert.equal(zeroSales.laborCostPercent, 0);
  assert.equal(zeroSales.rentPercent, 0);
  assert.equal(zeroSales.operatingMarginPercent, 0);
  assert.equal(zeroSales.salesPerLaborHour, 0);
  assert.equal(zeroSales.operatingIncome, -18000); // 0 - (5000 + 12000 + 1000)
  assert.equal(Number.isFinite(zeroSales.operatingMarginPercent), true);

  // Periodo corto de 7 días sin renta no debe generar RENT_MISSING
  const rentMissingAlert = zeroSales.costAlerts.find((a) => a.code === "RENT_MISSING");
  assert.equal(rentMissingAlert, undefined);
});

test("varianza exacta de insumos: detecta sobreconsumo y merma no justificada", () => {
  // Teórico de recetas: $10,000
  // Consumo real en libro: $12,500
  // Merma documentada explícitamente: $1,500
  // Varianza total = $2,500 ($1,500 merma registrada + $1,000 fuga no justificada)
  const branch = computeBranchFinancialMetrics({
    branchId: "b-bar",
    branchName: "Bar Barra",
    sales: 40000,
    saleCount: 80,
    cogs: 12500,
    cogsKnown: true,
    theoreticalCogs: 10000,
    theoreticalCogsKnown: true,
    wasteCost: 1500,
    closedLaborCost: 8000,
    accruedLaborCost: 0,
    closedLaborHours: 80,
    accruedLaborHours: 0,
    rentCost: 4000,
    cashOutflows: 500,
    accountingPayments: 500,
    otherExpenses: 1000,
  });

  assert.equal(branch.costVariance, 2500); // $12,500 - $10,000
  assert.equal(branch.wasteCost, 1500);
  assert.equal(branch.inventory.variance, 2500);
  assert.equal(branch.inventory.wasteCost, 1500);

  // 2500 / 40000 = 6.25% de varianza -> genera alerta de fuga
  const varianceAlert = branch.costAlerts.find((a) => a.code === "VARIANCE_HIGH");
  assert.ok(varianceAlert, "Debe generar alerta de varianza cuando supera el 5% de las ventas");
});

