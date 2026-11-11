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

