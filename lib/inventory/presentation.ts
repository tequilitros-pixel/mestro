export type Presentation = { handlingUnit?: string | null; contentPerUnit?: number | null; contentUnit?: string | null };

const MULTIPLIERS: Record<string, number> = { ML: 1, L: 1000, G: 1, KG: 1000, PIEZAS: 1 };
export function baseContent(presentation: Presentation) {
  if (!presentation.contentPerUnit || !presentation.contentUnit) return null;
  const multiplier = MULTIPLIERS[presentation.contentUnit];
  return multiplier ? presentation.contentPerUnit * multiplier : null;
}
export function normalizePresentationQuantity(units: number, remainder: number, presentation: Presentation) {
  const base = baseContent(presentation);
  if (!Number.isFinite(units) || !Number.isFinite(remainder) || units < 0 || remainder < 0) throw new Error("Cantidad inválida.");
  if (base === null) { if (remainder) throw new Error("El producto no tiene una presentación divisible configurada."); return units; }
  return units * base + remainder;
}
export function isDivisible(presentation: Presentation) { return baseContent(presentation) !== null && !["PIEZA", "CAJA", "PAQUETE"].includes(presentation.handlingUnit ?? ""); }
