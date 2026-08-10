/**
 * Cálculo puro del tiempo extra (sin acceso a base de datos), usado
 * tanto por app/actions/overtime.ts como por app/actions/payroll.ts.
 * Vive fuera de un archivo "use server" a propósito: Next.js exige
 * que TODO lo exportado de un módulo con "use server" sea una
 * función async (son Server Actions) — una función síncrona como
 * `splitTiers` rompe el build si se exporta desde ahí.
 */

export type PayrollSettingsValues = {
  weeklyHourThreshold: number;
  firstTierHours: number;
  firstTierMultiplier: number;
  secondTierMultiplier: number;
};

export function splitTiers(overtimeHours: number, settings: PayrollSettingsValues) {
  const doubleHours = Math.min(overtimeHours, settings.firstTierHours);
  const tripleHours = Math.max(overtimeHours - settings.firstTierHours, 0);
  return { doubleHours, tripleHours };
}

export function computeAmount(
  doubleHours: number,
  tripleHours: number,
  hourlyRate: number | null,
  settings: PayrollSettingsValues,
) {
  if (hourlyRate === null) return null;

  return (
    doubleHours * hourlyRate * settings.firstTierMultiplier +
    tripleHours * hourlyRate * settings.secondTierMultiplier
  );
}
