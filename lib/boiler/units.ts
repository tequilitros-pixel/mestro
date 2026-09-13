import { Prisma } from "@prisma/client";
import type { PressureUnit } from "@prisma/client";

export const GAS_TANK_CAPACITY_LITERS = new Prisma.Decimal(1000);
export const LITERS_PER_GAS_PERCENT = new Prisma.Decimal(10);
export const KG_CM2_TO_PSI = new Prisma.Decimal("14.223343307");

export function gasPercentToLiters(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).mul(LITERS_PER_GAS_PERCENT);
}

export function pressureToPsi(value: Prisma.Decimal.Value, unit: PressureUnit): Prisma.Decimal {
  const pressure = new Prisma.Decimal(value);
  return unit === "KG_CM2" ? pressure.mul(KG_CM2_TO_PSI) : pressure;
}

export function pressureUnitLabel(unit: PressureUnit): string {
  return unit === "KG_CM2" ? "kg/cm²" : "PSI";
}

export function decimalNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toString());
}

export type GasSummary = {
  initialLiters: number | null;
  finalLiters: number | null;
  refillLiters: number;
  netConsumptionLiters: number;
  durationHours: number;
  litersPerHour: number | null;
  litersPerMinute: number | null;
};

export function deriveGasSummary(readings: Array<{
  levelPercent: Prisma.Decimal | number | string;
  levelLiters?: Prisma.Decimal | number | string | null;
  type: string;
  occurredAt: Date | string;
}>): GasSummary {
  const ordered = [...readings].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  if (ordered.length === 0) return { initialLiters: null, finalLiters: null, refillLiters: 0, netConsumptionLiters: 0, durationHours: 0, litersPerHour: null, litersPerMinute: null };
  const liters = (r: typeof ordered[number]) => Number(r.levelLiters ?? gasPercentToLiters(r.levelPercent).toString());
  let consumption = 0;
  let refills = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const delta = liters(ordered[i]) - liters(ordered[i - 1]);
    if (delta < 0) consumption += -delta;
    if (delta > 0 || ordered[i].type === "REFILL") refills += Math.max(0, delta);
  }
  const durationHours = Math.max(0, (new Date(ordered.at(-1)!.occurredAt).getTime() - new Date(ordered[0].occurredAt).getTime()) / 3_600_000);
  return {
    initialLiters: liters(ordered[0]),
    finalLiters: liters(ordered.at(-1)!),
    refillLiters: refills,
    netConsumptionLiters: consumption,
    durationHours,
    litersPerHour: durationHours > 0 ? consumption / durationHours : null,
    litersPerMinute: durationHours > 0 ? consumption / (durationHours * 60) : null,
  };
}

export function deriveBoilerHorometer(sessions: Array<{ startedAt: Date | string; endedAt: Date | string | null }>, at = new Date()) {
  return sessions.reduce((total, session) => total + Math.max(0, new Date(session.endedAt ?? at).getTime() - new Date(session.startedAt).getTime()) / 3_600_000, 0);
}
