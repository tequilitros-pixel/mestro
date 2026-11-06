import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExtractedSugarKg,
  calculateSugarExtractionEfficiency,
  analyzeFermentationKinetics,
  calculateLAA,
  calculateSteamEnergyMetrics,
  calculateStageCostsAndWIP,
  calculateTheoreticalTequilaYield,
  calculateCookingYield,
  calculateDistillationFractionation,
  calculateLotMasterBalance,
} from "../lib/processCalculations";
import { getTotalLAA } from "../lib/services/distillation";
import { DistillationEventType } from "@prisma/client";

test("Balance de azúcares y eficiencia de extracción en molienda (ART)", () => {
  // 1000 L de mosto a 10 °Brix
  const sugarKg = calculateExtractedSugarKg(1000, 10);
  assert.ok(sugarKg > 100 && sugarKg < 110, `Esperado ~103.8 kg, obtenido ${sugarKg}`);

  // Para 1000 kg de agave con 26% ART teórico (= 260 kg azúcar teórico)
  const efficiency = calculateSugarExtractionEfficiency(104, 1000, 26);
  assert.equal(efficiency, 40);

  // Protección ante valores nulos o negativos
  assert.equal(calculateExtractedSugarKg(0, 10), 0);
  assert.equal(calculateSugarExtractionEfficiency(0, 1000), 0);
});

test("Detector cinético de fermentación y riesgo de estancamiento (Stuck Fermentation)", () => {
  const baseTime = new Date("2026-10-01T10:00:00Z").getTime();

  // Fermentación recién iniciada (1 lectura)
  const initialDiag = analyzeFermentationKinetics([
    { createdAt: new Date(baseTime), brix: 12.0 },
  ]);
  assert.equal(initialDiag.status, "EN_ARRANQUE");
  assert.equal(initialDiag.isStuckRisk, false);

  // Fermentación activa normal (baja 3 °Bx en 6 horas = 0.5 °Bx/h)
  const activeDiag = analyzeFermentationKinetics([
    { createdAt: new Date(baseTime), brix: 12.0 },
    { createdAt: new Date(baseTime + 6 * 3600 * 1000), brix: 9.0 },
  ]);
  assert.equal(activeDiag.status, "ACTIVA");
  assert.equal(activeDiag.consumptionRateBxPerHour, 0.5);
  assert.equal(activeDiag.isStuckRisk, false);

  // Fermentación estancada (apenas baja 0.1 °Bx en 10 horas y se queda en 8 °Bx)
  const stuckDiag = analyzeFermentationKinetics([
    { createdAt: new Date(baseTime), brix: 8.0 },
    { createdAt: new Date(baseTime + 10 * 3600 * 1000), brix: 7.95 },
  ]);
  assert.equal(stuckDiag.status, "ESTANCADA");
  assert.equal(stuckDiag.isStuckRisk, true);

  // Fermentación terminada (Brix <= 2)
  const finishedDiag = analyzeFermentationKinetics([
    { createdAt: new Date(baseTime), brix: 12.0 },
    { createdAt: new Date(baseTime + 48 * 3600 * 1000), brix: 1.5 },
  ]);
  assert.equal(finishedDiag.status, "TERMINADA");
  assert.equal(finishedDiag.isStuckRisk, false);
});

test("Cálculo de Litros de Alcohol Absoluto / Anhidro (LAA a 20°C)", () => {
  // 500 litros de tequila a 55% Alc. Vol. = 275 LAA
  assert.equal(calculateLAA(500, 55), 275);
  assert.equal(calculateLAA(0, 55), 0);
  assert.equal(calculateLAA(500, 0), 0);

  // Cálculo ponderado exacto por eventos de destilación
  const mockEvents = [
    {
      id: "1",
      distillationId: "d1",
      type: DistillationEventType.CORTE_CABEZAS,
      liters: 20,
      alcoholCorrected: 65,
      alcohol: 66,
      temperature: 80,
      outputTemperature: 22,
      notes: null,
      createdAt: new Date(),
    },
    {
      id: "2",
      distillationId: "d1",
      type: DistillationEventType.INICIO_CORAZON,
      liters: 200,
      alcoholCorrected: 55,
      alcohol: 56,
      temperature: 85,
      outputTemperature: 22,
      notes: null,
      createdAt: new Date(),
    },
    {
      id: "3",
      distillationId: "d1",
      type: DistillationEventType.INICIO_COLAS,
      liters: 50,
      alcoholCorrected: 25,
      alcohol: 26,
      temperature: 92,
      outputTemperature: 24,
      notes: null,
      createdAt: new Date(),
    },
  ];

  // 20*0.65 (13) + 200*0.55 (110) + 50*0.25 (12.5) = 135.5 LAA
  const totalLAA = getTotalLAA(mockEvents as any);
  assert.equal(totalLAA, 135.5);

  assert.equal(
    getTotalLAA([
      { ...mockEvents[0], alcoholCorrected: null },
    ] as any),
    null,
  );
});

test("Trazabilidad energética y consumo de vapor por tonelada", () => {
  const intervals = [
    {
      startedAt: new Date("2026-10-01T08:00:00Z"),
      endedAt: new Date("2026-10-01T14:00:00Z"), // 6 horas inyección
      state: "INYECTANDO",
    },
    {
      startedAt: new Date("2026-10-01T14:00:00Z"),
      endedAt: new Date("2026-10-01T20:00:00Z"), // 6 horas reposo
      state: "REPOSO",
    },
  ];

  const metrics = calculateSteamEnergyMetrics(intervals, 12000); // 12 Toneladas
  assert.equal(metrics.injectionHours, 6);
  assert.equal(metrics.restHours, 6);
  assert.equal(metrics.agaveTons, 12);
  assert.equal(metrics.hoursPerTon, 0.5); // 6 / 12 = 0.5 h/Ton
});

test("Costeo Basado en Actividades (ABC) y valoración del lote", () => {
  const expenses = [
    { category: "Materia prima", amount: 150000 },
    { category: "Transporte", amount: 15000 },
    { category: "Cocción", amount: 25000 },
    { category: "Molienda", amount: 10000 },
    { category: "Fermentación", amount: 8000 },
    { category: "Destilación", amount: 35000 },
    { category: "Mano de obra", amount: 30000 },
  ];

  const abc = calculateStageCostsAndWIP(expenses, "DESTILACION");
  assert.equal(abc.stageTotals.RECEPCION, 165000);
  assert.equal(abc.stageTotals.COCCION, 25000);
  assert.equal(abc.stageTotals.MOLIENDA, 10000);
  assert.equal(abc.stageTotals.FERMENTACION, 8000);
  assert.equal(abc.stageTotals.DESTILACION, 35000);
  assert.equal(abc.stageTotals.GENERAL, 30000);
  assert.equal(abc.totalCost, 273000);
  assert.equal(abc.currentLotStage, "DESTILACION");
});

test("Proyección teórica de rendimiento tequilero (Maestro Tequilero)", () => {
  // 10,000 kg de agave con 26% ART
  const proj = calculateTheoreticalTequilaYield(10000, 26);
  assert.equal(proj.estimatedSugarKg, 2600);
  assert.equal(proj.theoreticalTequila40Liters, 1350);
  assert.equal(proj.theoreticalLAALiters, 540);
  assert.equal(proj.expectedKgPerLiter, 7.41);

  // Casos límite
  const zeroProj = calculateTheoreticalTequilaYield(0);
  assert.equal(zeroProj.theoreticalTequila40Liters, 0);
  assert.equal(zeroProj.expectedKgPerLiter, 0);
});

test("Balance de cocimiento y merma de masa", () => {
  // 5000 kg agave crudo -> 4300 kg agave cocido (700 kg merma = 14%)
  // 250 L de mieles dulces a 20 °Brix
  const cooking = calculateCookingYield(5000, 4300, 250, 20);
  assert.equal(cooking.weightLossKg, 700);
  assert.equal(cooking.weightLossPercent, 14);
  assert.equal(cooking.sweetHoneyLiters, 250);
  assert.ok(cooking.sweetHoneySugarKg > 50, `Esperado >50 kg azúcar en mieles dulces, obtenido ${cooking.sweetHoneySugarKg}`);
});

test("Fraccionamiento alcohólico y balance de LAA en destilación", () => {
  // Rectificación con cortes maestros:
  // Cabezas: 15 L a 65% Alc. Vol. = 9.75 LAA
  // Corazón: 500 L a 55% Alc. Vol. = 275 LAA
  // Colas: 50 L a 25% Alc. Vol. = 12.5 LAA
  const frac = calculateDistillationFractionation(15, 65, 500, 55, 50, 25);
  assert.equal(frac.totalLiters, 565);
  assert.equal(frac.totalLAA, 297.25);
  assert.equal(frac.heads.laa, 9.75);
  assert.equal(frac.heart.laa, 275);
  assert.equal(frac.tails.laa, 12.5);
  assert.ok(frac.heart.laaPercent > 90, `El corazón debe concentrar >90% del LAA recuperado, obtenido ${frac.heart.laaPercent}%`);
});

test("Balance maestro integral del lote tequilero", () => {
  const master = calculateLotMasterBalance({
    agaveKg: 7000,
    art: 26,
    totalLitersObtained: 850,
    totalCost: 95000,
    cookings: [{ agaveKg: 7000, finalAgaveKg: 6100, finalSweetHoneyLiters: 300, finalSweetHoneyBrix: 22, status: "TERMINADA" }],
    millings: [{ cookedKg: 6100, mashLiters: 5800, finalMashLiters: 5800, brix: 13, finalAverageBrix: 13, status: "TERMINADA" }],
    fermentations: [{ mustLiters: 5800, initialBrix: 13, finalBrix: 1.2, finalAlcohol: 5.8, status: "TERMINADA" }],
    distillations: [
      { type: "DESTROZADO", loadedLiters: 5800, finalLiters: 1600, finalAlcohol: 25, heartLiters: 1600, status: "TERMINADA" },
      { type: "RECTIFICACION", loadedLiters: 1600, finalLiters: 850, finalAlcohol: 48, heartLiters: 850, status: "TERMINADA" },
    ],
  });

  assert.equal(master.actualLiters, 850);
  assert.equal(master.actualKgPerLiter, 8.24); // 7000 / 850 = 8.24 kg/L (EXCELENTE)
  assert.equal(master.qualityRating, "EXCELENTE");
  assert.equal(master.costPerLAA, 232.84); // 95000 / 408 LAA
  assert.ok(master.totalHeartLAA > 400);
});
