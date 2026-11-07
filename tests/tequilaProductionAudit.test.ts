import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTheoreticalTequilaYield,
  calculateCookingYield,
  calculateExtractedSugarKg,
  calculateSugarExtractionEfficiency,
  analyzeFermentationKinetics,
  calculateLAA,
  calculateDistillationFractionation,
  calculateSteamEnergyMetrics,
  calculateStageCostsAndWIP,
  calculateLotMasterBalance,
} from "../lib/processCalculations";
import { getLotFinalization } from "../lib/lots/finalization";

test("AUDITORÍA MAESTRO TEQUILERO: Flujo Completo de Producción de Principio a Fin (Destiladora del Norte)", () => {
  // ==========================================
  // FASE 1: RECEPCIÓN DE AGAVE Y REGISTRO DE LOTE
  // ==========================================
  const agaveKg = 7000;
  const art = 26; // 26% Azúcares Reductores Totales

  const projection = calculateTheoreticalTequilaYield(agaveKg, art);
  assert.equal(projection.estimatedSugarKg, 1820); // 7000 * 0.26
  assert.equal(projection.theoreticalTequila40Liters, 945); // ~945 L tequila comercial 40%
  assert.equal(projection.expectedKgPerLiter, 7.41); // 7.41 kg de agave / L tequila
  assert.equal(projection.theoreticalLAALiters, 378); // 945 * 0.40

  // ==========================================
  // FASE 2: CALDERA Y TRAZABILIDAD ENERGÉTICA
  // ==========================================
  const steamIntervals = [
    {
      startedAt: new Date("2026-11-04T08:00:00Z"),
      endedAt: new Date("2026-11-04T16:00:00Z"), // 8 horas inyección de vapor
      state: "INYECTANDO",
    },
    {
      startedAt: new Date("2026-11-04T16:00:00Z"),
      endedAt: new Date("2026-11-04T22:00:00Z"), // 6 horas reposo térmico
      state: "REPOSO",
    },
  ];
  const energyMetrics = calculateSteamEnergyMetrics(steamIntervals, agaveKg);
  assert.equal(energyMetrics.injectionHours, 8);
  assert.equal(energyMetrics.restHours, 6);
  assert.equal(energyMetrics.agaveTons, 7);
  assert.equal(energyMetrics.hoursPerTon, 1.14); // 8 h / 7 Ton

  // ==========================================
  // FASE 3: COCIMIENTO (HORNO) E HIDRÓLISIS
  // ==========================================
  // Mieles amargas desechadas en desamargue.
  // Mieles dulces recuperadas: 350 L a 22 °Brix.
  // Agave cocido pesado al descargar: 6,100 kg (merma de peso por evaporación y drenado).
  const finalAgaveKg = 6100;
  const sweetHoneyLiters = 350;
  const sweetHoneyBrix = 22;

  const cookingBalance = calculateCookingYield(agaveKg, finalAgaveKg, sweetHoneyLiters, sweetHoneyBrix);
  assert.equal(cookingBalance.weightLossKg, 900); // 7000 - 6100 = 900 kg
  assert.equal(cookingBalance.weightLossPercent, 12.9); // 12.9% de merma
  assert.ok(cookingBalance.sweetHoneySugarKg > 80, "Mieles dulces aportan azúcares significativos");

  // ==========================================
  // FASE 4: MOLIENDA Y EXTRACCIÓN DE JUGO (MOSTO)
  // ==========================================
  const mashLiters = 5800; // 5,800 L de mosto extraído
  const mashBrix = 13.0; // 13 °Brix (densidad ideal para fermentación tequilera)

  const extractedSugarKg = calculateExtractedSugarKg(mashLiters, mashBrix);
  assert.ok(extractedSugarKg > 750 && extractedSugarKg < 850, `Azúcar extraído: ${extractedSugarKg} kg`);

  const extractionEfficiency = calculateSugarExtractionEfficiency(extractedSugarKg, agaveKg, art);
  assert.ok(extractionEfficiency > 40 && extractionEfficiency < 50, `Eficiencia molienda: ${extractionEfficiency}%`);

  // ==========================================
  // FASE 5: CINÉTICA DE FERMENTACIÓN EN TINA
  // ==========================================
  const t0 = new Date("2026-11-04T12:00:00Z").getTime();
  const fermentationReadings = [
    { createdAt: new Date(t0), brix: 13.0, ph: 4.8, temperature: 28.0, alcohol: 0 },
    { createdAt: new Date(t0 + 12 * 3600 * 1000), brix: 9.5, ph: 4.6, temperature: 31.5, alcohol: 2.1 },
    { createdAt: new Date(t0 + 24 * 3600 * 1000), brix: 5.2, ph: 4.4, temperature: 33.0, alcohol: 4.4 },
    { createdAt: new Date(t0 + 40 * 3600 * 1000), brix: 1.2, ph: 4.3, temperature: 30.0, alcohol: 6.2 },
  ];

  // Evaluar cinética en tiempo real
  const activeKinetics = analyzeFermentationKinetics(fermentationReadings.slice(0, 3));
  assert.equal(activeKinetics.status, "ACTIVA");
  assert.equal(activeKinetics.isStuckRisk, false);

  // Al llegar a 1.2 °Brix es "Mosto Muerto" listo para destilar
  const finishedKinetics = analyzeFermentationKinetics(fermentationReadings);
  assert.equal(finishedKinetics.status, "TERMINADA");
  assert.equal(finishedKinetics.isStuckRisk, false);

  // ==========================================
  // FASE 6: DESTILACIÓN Y CORTES MAESTROS
  // ==========================================
  // 1ª Destilación (Destrozado): 5,800 L mosto al 6.2% -> 1,600 L ordinario a 22%
  // 2ª Destilación (Rectificación): 1,600 L ordinario cargado -> Cortes de cabezas, corazón y colas
  const headsLiters = 25;
  const headsAlcohol = 68;
  const heartLiters = 850; // Tequila Blanco de alta calidad
  const heartAlcohol = 50; // 50% Alc. Vol. de salida de alambique
  const tailsLiters = 90;
  const tailsAlcohol = 22;

  const fractionation = calculateDistillationFractionation(
    headsLiters,
    headsAlcohol,
    heartLiters,
    heartAlcohol,
    tailsLiters,
    tailsAlcohol
  );

  assert.equal(fractionation.totalLiters, 965);
  assert.equal(fractionation.heads.laa, 17); // 25 * 0.68
  assert.equal(fractionation.heart.laa, 425); // 850 * 0.50 = 425 LAA
  assert.equal(fractionation.tails.laa, 19.8); // 90 * 0.22
  assert.ok(fractionation.heart.laaPercent > 90, "El corazón concentra >90% del alcohol aprovechable");

  // ==========================================
  // FASE 7: GASTOS Y COSTEO ABC
  // ==========================================
  const expenses = [
    { category: "Materia prima", amount: 35000 },
    { category: "Cocción", amount: 8500 },
    { category: "Molienda", amount: 4500 },
    { category: "Fermentación", amount: 3500 },
    { category: "Destilación", amount: 12000 },
    { category: "Mano de obra", amount: 15000 },
  ];
  const abc = calculateStageCostsAndWIP(expenses, "TERMINADO");
  assert.equal(abc.totalCost, 78500);

  // ==========================================
  // FASE 8: FINALIZACIÓN DEL LOTE Y BALANCE MAESTRO
  // ==========================================
  const finalizationCheck = getLotFinalization({
    stage: "TERMINADO",
    finishedAt: null,
    totalLitersObtained: null,
    runs: [
      { type: "DESTROZADO", status: "TERMINADA", finalLiters: 1600 },
      { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 850 },
    ],
  });
  assert.equal(finalizationCheck.ready, true);
  if (finalizationCheck.ready) {
    assert.equal(finalizationCheck.totalLiters, 850);
  }

  const masterBalance = calculateLotMasterBalance({
    agaveKg,
    art,
    totalLitersObtained: 850,
    totalCost: abc.totalCost,
    cookings: [{ agaveKg, finalAgaveKg, finalSweetHoneyLiters: sweetHoneyLiters, finalSweetHoneyBrix: sweetHoneyBrix, status: "TERMINADA" }],
    millings: [{ cookedKg: finalAgaveKg, mashLiters, finalMashLiters: mashLiters, brix: mashBrix, finalAverageBrix: mashBrix, status: "TERMINADA" }],
    fermentations: [{ mustLiters: mashLiters, initialBrix: 13, finalBrix: 1.2, finalAlcohol: 6.2, status: "TERMINADA" }],
    distillations: [
      { type: "DESTROZADO", loadedLiters: mashLiters, finalLiters: 1600, finalAlcohol: 22, heartLiters: 1600, status: "TERMINADA" },
      { type: "RECTIFICACION", loadedLiters: 1600, finalLiters: 850, finalAlcohol: 50, heartLiters: 850, status: "TERMINADA" },
    ],
  });

  assert.equal(masterBalance.actualLiters, 850);
  assert.equal(masterBalance.actualKgPerLiter, 8.24); // 7000 kg / 850 L = 8.24 kg/L (Tequila de Calidad Superior)
  assert.equal(masterBalance.qualityRating, "EXCELENTE");
  assert.equal(masterBalance.actualCostPerLiter, 92.35); // $78,500 / 850 L = $92.35 por litro
  assert.equal(masterBalance.costPerLAA, 184.71); // $78,500 / 425 LAA = $184.71 por LAA
  assert.equal(masterBalance.totalHeartLAA, 425);
});

test("TABULADOR DE AGAVE: Costo Real Puesto en Fábrica por Kg y Piña (Jima Propia)", () => {
  const harvest = {
    rancho: "Rancho El Mezquite",
    totalKg: 15000, // 15 Toneladas en báscula
    totalPinadas: 420, // 420 piñas
    gasolineCost: 3500, // Camionetas de traslado
    dieselCost: 6200, // Camión rabón a destilería
    foodCost: 2800, // Almuerzos, hidratación y sueros
    oilCost: 1100, // Aceite 2T, limas, coas
    payrollCost: 18500, // Cuadrilla de jimadores y cargadores
    landRentCost: 0, // Predio propio
    otherCost: 900, // Báscula pública y maniobras
  };

  const totalExpenses =
    harvest.gasolineCost +
    harvest.dieselCost +
    harvest.foodCost +
    harvest.oilCost +
    harvest.payrollCost +
    harvest.landRentCost +
    harvest.otherCost;

  assert.equal(totalExpenses, 33000);

  const costPerKg = totalExpenses / harvest.totalKg;
  assert.equal(costPerKg, 2.2); // $2.20 / kg agave puesto en fábrica

  const costPerPina = Number((totalExpenses / harvest.totalPinadas).toFixed(2));
  assert.equal(costPerPina, 78.57); // $78.57 por piña

  const avgWeightPerPina = Number((harvest.totalKg / harvest.totalPinadas).toFixed(2));
  assert.equal(avgWeightPerPina, 35.71); // 35.71 kg por piña en promedio

  // Si se necesitan 7.4 kg de agave por cada litro de tequila a 40%:
  const rawMaterialPerLiterTequila = Number((costPerKg * 7.4).toFixed(2));
  assert.equal(rawMaterialPerLiterTequila, 16.28); // $16.28 / L tequila solo materia prima
});
