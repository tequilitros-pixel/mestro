export type DateRange = { effectiveFrom: Date; effectiveTo: Date | null };

export function rangesOverlap(left: DateRange, right: DateRange) {
  const leftEnd = left.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.effectiveFrom.getTime() < rightEnd && right.effectiveFrom.getTime() < leftEnd;
}

export function assertValidRange(range: DateRange) {
  if (range.effectiveTo && range.effectiveTo <= range.effectiveFrom) {
    throw new Error("La fecha final debe ser posterior a la fecha inicial.");
  }
}

export function assertNativeCurrency(currency: string | null | undefined) {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Una tarifa nativa requiere moneda ISO-4217 de tres letras.");
  }
}

export function assertWorkforceAdministrator(user: { role: string } | null) {
  if (!user || user.role !== "ADMIN") throw new Error("No autorizado");
}
