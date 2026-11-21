import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExtractedSugarKg,
  calculateSugarExtractionEfficiency,
  analyzeFermentationKinetics,
  calculateLAA,
  calculateSteamEnergyMetrics,
  calculateStageCostsAndWIP,
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
