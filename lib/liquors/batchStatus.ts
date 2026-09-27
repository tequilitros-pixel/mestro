import type { LiquorBatchStatus } from "@prisma/client";

/** Derive exhaustion from bottling records without rewriting historical batches. */
export function getEffectiveLiquorBatchStatus(batch: {
  status: LiquorBatchStatus;
  actualLiters: number | null;
  plannedLiters: number;
  bottlings: Array<{ litersUsed: number | null }>;
}): LiquorBatchStatus {
  if (batch.status !== "EMBOTELLANDO" && batch.status !== "LISTO_PARA_EMBOTELLAR") return batch.status;
  const volume = batch.actualLiters ?? batch.plannedLiters;
  const used = batch.bottlings.reduce((sum, bottling) => sum + (bottling.litersUsed ?? 0), 0);
  return volume > 0 && used >= volume - 0.0001 ? "TERMINADO" : batch.status;
}
