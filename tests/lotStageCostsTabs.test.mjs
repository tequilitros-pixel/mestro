import assert from "node:assert/strict";
import test from "node:test";
import { calculateStageCostsAndWIP } from "../lib/processCalculations.ts";

const STAGE_FILTERS = {
  materiaPrima: ["Materia prima", "Transporte", "Agave", "Flete", "Jima"],
  cocimiento: ["Cocción", "Cocimiento", "Gas", "Caldera"],
  molienda: ["Molienda", "Agua"],
  fermentacion: ["Fermentación", "Levadura", "Nutrientes"],
  destilacion: ["Destilación", "Alambique"],
};

function matchesStage(category, filterList) {
  return filterList.some((c) => c.toLowerCase() === (category || "").toLowerCase());
}

test("Separación de gastos por pestañas de etapa tequilera", () => {
  const lotExpenses = [
    // Materia Prima (Agave)
    { id: "e1", category: "Materia prima", concept: "Agave Tequilana Weber 15 ton", amount: 120000 },
    { id: "e2", category: "Transporte", concept: "Flete de campo a fábrica", amount: 15000 },
    { id: "e3", category: "Jima", concept: "Cuadrilla de corte y descorone", amount: 8000 },

    // Cocimiento
    { id: "e4", category: "Cocción", concept: "Gas LP caldera vapor", amount: 22000 },
    { id: "e5", category: "Caldera", concept: "Mantenimiento y sellos de horno", amount: 3500 },

    // Molienda
    { id: "e6", category: "Molienda", concept: "Mantenimiento cuchillas desgarradora", amount: 7500 },
    { id: "e7", category: "Agua", concept: "Agua tratada de extracción", amount: 2000 },

    // Fermentación
    { id: "e8", category: "Fermentación", concept: "Levadura seca tequilera", amount: 6500 },
    { id: "e9", category: "Nutrientes", concept: "Sulfato de amonio y fosfato", amount: 2500 },

    // Destilación
    { id: "e10", category: "Destilación", concept: "Gas LP alambiques destrozado y rectificación", amount: 30000 },
    { id: "e11", category: "Alambique", concept: "Sellos sanitarios y empaques de cobre", amount: 4500 },

    // Otros / Mano de obra
    { id: "e12", category: "Mano de obra", concept: "Jornales generales", amount: 18000 },
  ];

  // Filtros por etapa
  const materiaPrima = lotExpenses.filter((e) => matchesStage(e.category, STAGE_FILTERS.materiaPrima));
  const cocimiento = lotExpenses.filter((e) => matchesStage(e.category, STAGE_FILTERS.cocimiento));
  const molienda = lotExpenses.filter((e) => matchesStage(e.category, STAGE_FILTERS.molienda));
  const fermentacion = lotExpenses.filter((e) => matchesStage(e.category, STAGE_FILTERS.fermentacion));
  const destilacion = lotExpenses.filter((e) => matchesStage(e.category, STAGE_FILTERS.destilacion));
  const otros = lotExpenses.filter(
    (e) =>
      !matchesStage(e.category, STAGE_FILTERS.materiaPrima) &&
      !matchesStage(e.category, STAGE_FILTERS.cocimiento) &&
      !matchesStage(e.category, STAGE_FILTERS.molienda) &&
      !matchesStage(e.category, STAGE_FILTERS.fermentacion) &&
      !matchesStage(e.category, STAGE_FILTERS.destilacion)
  );

  // Verificación de conteos
  assert.equal(materiaPrima.length, 3, "Materia prima debe tener 3 gastos");
  assert.equal(cocimiento.length, 2, "Cocimiento debe tener 2 gastos");
  assert.equal(molienda.length, 2, "Molienda debe tener 2 gastos");
  assert.equal(fermentacion.length, 2, "Fermentación debe tener 2 gastos");
  assert.equal(destilacion.length, 2, "Destilación debe tener 2 gastos");
  assert.equal(otros.length, 1, "Otros debe tener 1 gasto");

  // Subtotales individuales
  const subMateriaPrima = materiaPrima.reduce((s, e) => s + e.amount, 0);
  const subCocimiento = cocimiento.reduce((s, e) => s + e.amount, 0);
  const subMolienda = molienda.reduce((s, e) => s + e.amount, 0);
  const subFermentacion = fermentacion.reduce((s, e) => s + e.amount, 0);
  const subDestilacion = destilacion.reduce((s, e) => s + e.amount, 0);
  const subOtros = otros.reduce((s, e) => s + e.amount, 0);

  assert.equal(subMateriaPrima, 143000);
  assert.equal(subCocimiento, 25500);
  assert.equal(subMolienda, 9500);
  assert.equal(subFermentacion, 9000);
  assert.equal(subDestilacion, 34500);
  assert.equal(subOtros, 18000);

  // Resumen General: Conjugación de todos los gastos de todas las pestañas
  const totalCost = lotExpenses.reduce((s, e) => s + e.amount, 0);
  const conjugatedSum = subMateriaPrima + subCocimiento + subMolienda + subFermentacion + subDestilacion + subOtros;

  assert.equal(totalCost, 239500, "Costo total conjugado debe ser $239,500");
  assert.equal(conjugatedSum, totalCost, "La suma conjugada de las pestañas debe coincidir exactamente con el total del lote");

  // Verificación de Costeo Basado en Actividades (ABC)
  const abc = calculateStageCostsAndWIP(lotExpenses, "DESTILACION");
  assert.equal(abc.stageTotals.RECEPCION, 143000);
  assert.equal(abc.stageTotals.COCCION, 25500);
  assert.equal(abc.stageTotals.MOLIENDA, 9500);
  assert.equal(abc.stageTotals.FERMENTACION, 9000);
  assert.equal(abc.stageTotals.DESTILACION, 34500);
  assert.equal(abc.stageTotals.GENERAL, 18000);
  assert.equal(abc.totalCost, 239500);

  // Proporción porcentual
  const percentMateriaPrima = (subMateriaPrima / totalCost) * 100;
  assert.ok(percentMateriaPrima > 59 && percentMateriaPrima < 60, `Esperado ~59.7%, obtenido ${percentMateriaPrima.toFixed(1)}%`);

  // Métricas unitarias con 2,000 L de tequila rectificado obtenido a 40% Alc. Vol.
  const producedLiters = 2000;
  const costPerLiter = totalCost / producedLiters;
  assert.equal(costPerLiter, 119.75, "Costo por litro debe ser $119.75/L");

  // 2,000 L al 40% = 800 LAA
  const totalLAA = (producedLiters * 40) / 100;
  const costPerLAA = totalCost / totalLAA;
  assert.equal(costPerLAA, 299.375, "Costo por LAA debe ser $299.38/LAA");

  // Costo de agave crudo por kg (si el lote fue de 15,000 kg)
  const agaveKg = 15000;
  const agaveCostPerKg = subMateriaPrima / agaveKg;
  assert.equal(Number(agaveCostPerKg.toFixed(2)), 9.53, "Costo de agave puesto en fábrica debe ser $9.53/kg");
});
