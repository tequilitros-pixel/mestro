import { LotStage } from "@prisma/client";

// El lote puede seguir recibiendo nuevas moliendas mientras otras tinas
// ya están en fermentación o destilación. Solo el cierre del lote es definitivo.
export const MILLING_ALLOWED_LOT_STAGES: LotStage[] = [
  LotStage.COCCION,
  LotStage.MOLIENDA,
  LotStage.FERMENTACION,
  LotStage.DESTILACION,
  LotStage.RECTIFICACION,
];

// No repetir automáticamente el peso total de cocción en jornadas posteriores.
// Se captura el peso real trabajado en cada molienda.
export function suggestedMillingCookedKg(
  totalCookedKg: number,
  previousMillingCount: number,
): number | null {
  return previousMillingCount === 0 && Number.isFinite(totalCookedKg) && totalCookedKg > 0
    ? totalCookedKg
    : null;
}
