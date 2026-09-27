type ProductionLot = {
  stage: string;
  totalLitersObtained: number | null;
  distillations: Array<{ type: string; status: string; finalLiters: number | null; heartLiters: number | null }>;
};

/** Final declared volume wins; legacy closed runs are a read-only fallback. */
export function getProductionVolume(lot: ProductionLot): number | null {
  if (lot.totalLitersObtained !== null) return lot.totalLitersObtained;
  if (lot.stage !== "TERMINADO" || lot.distillations.some((run) => run.status === "ACTIVA")) return null;
  const runs = lot.distillations.filter((run) => run.type === "RECTIFICACION" && run.status === "TERMINADA");
  if (!runs.length || runs.some((run) => (run.finalLiters ?? run.heartLiters) === null)) return null;
  return runs.reduce((sum, run) => sum + (run.finalLiters ?? run.heartLiters ?? 0), 0);
}
