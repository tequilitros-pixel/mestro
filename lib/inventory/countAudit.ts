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
  if (!Number.isFinite(missingCost) || missingCost < 0) return false;
  const presentation =
    normalizedContentPerUnit !== null &&
    Number.isFinite(normalizedContentPerUnit) &&
    normalizedContentPerUnit > 0
      ? normalizedContentPerUnit
      : 1;
  return expected > 50 * Math.max(counted, presentation)
    && (missingCost >= 5000 || expected - counted >= 1000 * presentation);
}

/**
 * La captura inicial y el cierre NO deben aceptar silenciosamente incrementos
 * masivos en unidades base. Una explicación explícita permite un alta legítima
 * de gran volumen y queda guardada en el renglón de conteo / movimiento.
 * También alerta altas de inventario inicialmente en cero de al menos cinco
 * presentaciones y $5,000 de valor, sin calificarlas automáticamente como merma.
 */
export function isImplausibleInventoryIncrease(input: {
  expected: number;
  captured: number;
  normalizedContentPerUnit: number | null;
  costPerBaseUnit: number | null;
}): boolean {
  const { expected, captured, normalizedContentPerUnit, costPerBaseUnit } = input;
  if (!Number.isFinite(expected) || !Number.isFinite(captured) || expected < 0 || captured <= expected) return false;
  const factor = normalizedContentPerUnit !== null
    && Number.isFinite(normalizedContentPerUnit)
    && normalizedContentPerUnit > 0
    ? normalizedContentPerUnit : 1;
  const cost = costPerBaseUnit !== null && Number.isFinite(costPerBaseUnit) && costPerBaseUnit > 0
    ? costPerBaseUnit : 0;
  const largeUnexplainedInitialStock = expected === 0
    && captured >= 5 * factor
    && (captured - expected) * cost >= 5000;
  return largeUnexplainedInitialStock || (
    captured > 50 * Math.max(expected, factor)
    && ((captured - expected) * cost >= 5000 || captured - expected >= 1000 * factor)
  );
}

/** Los importes del reporte se suman a partir de cada partida redondeada a centavos. */
export function countAmountInPesos(quantityBase: number, costPerBaseUnit: number): number {
  if (!Number.isFinite(quantityBase) || quantityBase <= 0
    || !Number.isFinite(costPerBaseUnit) || costPerBaseUnit <= 0) return 0;
  return Math.round((quantityBase * costPerBaseUnit + Number.EPSILON) * 100) / 100;
}
