export function calculateAbsoluteAlcohol(liters: number, alcoholPercent: number) {
  if (liters <= 0 || alcoholPercent <= 0) return 0;

  return Number(((liters * alcoholPercent) / 100).toFixed(2));
}

export function calculateFermentationProgress(
  initialBrix: number,
  currentBrix: number,
  targetBrix = 2
) {
  if (initialBrix <= targetBrix) return 0;

  const progress =
    ((initialBrix - currentBrix) / (initialBrix - targetBrix)) * 100;

  return Number(Math.min(100, Math.max(0, progress)).toFixed(1));
}

export function calculateMillingEfficiency(
  recoveredLiters: number,
  cookedKg: number
) {
  if (recoveredLiters <= 0 || cookedKg <= 0) return 0;

  return Number((recoveredLiters / cookedKg).toFixed(2));
}

export function calculateDistillationYield(
  producedLiters: number,
  loadedLiters: number
) {
  if (producedLiters <= 0 || loadedLiters <= 0) return 0;

  return Number(((producedLiters / loadedLiters) * 100).toFixed(2));
}

/**
 * Corrección aproximada de alcohol a 20°C.
 * Esta es una estimación operativa.
 * Más adelante podemos reemplazarla por tabla oficial alcoholométrica.
 */
export function calculateCorrectedAlcohol(
  observedAlcohol: number,
  temperatureC: number
) {
  if (observedAlcohol <= 0) return 0;

  const correction = (temperatureC - 20) * 0.18;
  const corrected = observedAlcohol + correction;

  return Number(corrected.toFixed(2));
}