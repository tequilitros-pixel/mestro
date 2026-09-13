export const TARGET_BRIX = 2;
type NumericValue = number | null | undefined;
type Reading = {
  brix?: NumericValue;
  ph?: NumericValue;
  temperature?: NumericValue;
  alcohol?: NumericValue;
  saccharometer?: NumericValue;
};
export type FermentationHealth = "ATENCION" | "LISTA" | "SALUDABLE" | "TERMINADA";

export function getLatestNumericValue<T extends Reading>(readings: T[], field: keyof Reading) {
  for (const reading of readings) {
    const value = reading[field];
    if (value !== null && value !== undefined) return Number(value);
  }
  return null;
}

export function getPreviousNumericValue<T extends Reading>(readings: T[], field: keyof Reading) {
  let valuesFound = 0;
  for (const reading of readings) {
    const value = reading[field];
    if (value !== null && value !== undefined && ++valuesFound === 2) return Number(value);
  }
  return null;
}

export function evaluateFermentation({
  initialBrix, currentBrix, currentPh, currentTemp, isFinished,
}: {
  initialBrix: number;
  currentBrix: number;
  currentPh: number;
  currentTemp: number;
  isFinished: boolean;
}) {
  const progress = initialBrix > TARGET_BRIX
    ? Math.min(100, Math.max(0, ((initialBrix - currentBrix) / (initialBrix - TARGET_BRIX)) * 100))
    : 0;
  const temperatureStatus = currentTemp > 35 ? "ALTA" : currentTemp < 25 ? "BAJA" : "ÓPTIMA";
  const phStatus = currentPh > 5 ? "ALTO" : currentPh < 3.8 ? "BAJO" : "ÓPTIMO";
  const brixStatus = currentBrix <= TARGET_BRIX ? "LISTA" : currentBrix <= 5 ? "CERCA DE META" : "DESCENDIENDO";
  const isReady = currentBrix <= TARGET_BRIX;
  const health: FermentationHealth = isFinished
    ? "TERMINADA"
    : temperatureStatus !== "ÓPTIMA" || phStatus !== "ÓPTIMO"
      ? "ATENCION"
      : isReady ? "LISTA" : "SALUDABLE";
  return { progress, temperatureStatus, phStatus, brixStatus, isReady, health };
}

export function getHealthTitle(health: FermentationHealth) {
  if (health === "ATENCION") return "Revisar fermentación";
  if (health === "LISTA") return "Lista para pasar a destilación";
  if (health === "TERMINADA") return "Proceso terminado";
  return "La fermentación avanza correctamente";
}
