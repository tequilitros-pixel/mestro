/**
 * Ledger de entradas físicas: la carga inicial sigue en Distillation.loadedLiters
 * para no alterar el historial; cada entrada posterior queda registrada por fuente.
 * Nunca imputar toda la salida de un alambique mezclado a una tina particular.
 */
type PrimaryLoad = { loadedLiters: number; status: string; finishedAt?: Date | null };
type AdditionalLoad = { liters: number; distillation: { status: string; finishedAt?: Date | null } };
export type SourceLedger = {
  distillations: PrimaryLoad[];
  supplementalLoads: AdditionalLoad[];
};

export const sumAdditionalLoads = (items: readonly { liters: number }[]) =>
  items.reduce((sum, item) => sum + item.liters, 0);

export const totalRunLoadedLiters = (run: { loadedLiters: number; supplementalLoads: { liters: number }[] }) =>
  run.loadedLiters + sumAdditionalLoads(run.supplementalLoads);

export function allocatedFermentationLiters(source: SourceLedger) {
  const initial = source.distillations
    .filter((run) => run.status !== "CANCELADA")
    .reduce((sum, run) => sum + run.loadedLiters, 0);
  const later = source.supplementalLoads
    .filter((load) => load.distillation.status !== "CANCELADA")
    .reduce((sum, load) => sum + load.liters, 0);
  return initial + later;
}

export function fermentationHasActiveLoad(source: SourceLedger) {
  return source.distillations.some((run) => run.status === "ACTIVA")
    || source.supplementalLoads.some((load) => load.distillation.status === "ACTIVA");
}

export function fermentationLatestFinishedLoad(source: SourceLedger) {
  const dates = [
    ...source.distillations.filter((run) => run.status === "TERMINADA").map((run) => run.finishedAt),
    ...source.supplementalLoads.filter((load) => load.distillation.status === "TERMINADA")
      .map((load) => load.distillation.finishedAt),
  ].filter((date): date is Date => date instanceof Date);
  return dates.reduce((latest, date) => date > latest ? date : latest, new Date(0));
}

export function fermentationHasCompletedLoad(source: SourceLedger) {
  return source.distillations.some((run) => run.status === "TERMINADA")
    || source.supplementalLoads.some((load) => load.distillation.status === "TERMINADA");
}
