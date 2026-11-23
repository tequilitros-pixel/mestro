/**
 * Detecta descuadres históricos de magnitud extraordinaria que podrían deberse
 * a errores de captura/conversión. No demuestra que el registro sea incorrecto:
 * se conserva para revisión humana y se reporta separado de los demás faltantes.
 *
 * Condición conservadora: existencia teórica > 50 veces el mayor de
 * (cantidad contada, tamaño de la presentación), con efecto >= $5,000 MXN.
 */
export function isPotentialInventoryCountOutlier(input: {
  expected: number;
  counted: number | null;
  normalizedContentPerUnit: number | null;
  missingCost: number;
}): boolean {
  const { expected, counted, normalizedContentPerUnit, missingCost } = input;
  if (counted === null || !Number.isFinite(counted) || counted < 0) return false;
  if (!Number.isFinite(expected) || expected <= 0) return false;
  if (!Number.isFinite(missingCost) || missingCost < 5000) return false;
  const presentation =
    normalizedContentPerUnit !== null &&
    Number.isFinite(normalizedContentPerUnit) &&
    normalizedContentPerUnit > 0
      ? normalizedContentPerUnit
      : 1;
  return expected > 50 * Math.max(counted, presentation);
}
