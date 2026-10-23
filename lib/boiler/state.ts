import { Prisma } from "@prisma/client";
import type { SteamInjectionState } from "@prisma/client";

export type SteamIntervalLike = {
  id: string;
  state: SteamInjectionState;
  startedAt: Date | string;
  endedAt: Date | string | null;
  pressureReadings?: Array<{ occurredAt: Date | string; canonicalPsi: Prisma.Decimal | number | string }>;
};

export function reconstructSteamState(intervals: SteamIntervalLike[], at = new Date()) {
  const active = intervals
    .filter((interval) => new Date(interval.startedAt).getTime() <= at.getTime() && (!interval.endedAt || new Date(interval.endedAt).getTime() > at.getTime()))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ?? null;
  return { state: active?.state ?? ("SIN_INYECCION" as SteamInjectionState), activeInterval: active };
}

export function deriveSteamTotals(intervals: SteamIntervalLike[], processStartedAt: Date | string, processEndedAt: Date | string | null, at = new Date()) {
  const start = new Date(processStartedAt).getTime();
  const end = new Date(processEndedAt ?? at).getTime();
  const totalMs = Math.max(0, end - start);
  const withSteamMs = intervals.reduce((total, interval) => {
    if (interval.state !== "INYECTANDO") return total;
    const from = Math.max(start, new Date(interval.startedAt).getTime());
    const to = Math.min(end, new Date(interval.endedAt ?? at).getTime());
    return total + Math.max(0, to - from);
  }, 0);
  return {
    totalMinutes: totalMs / 60_000,
    withSteamMinutes: withSteamMs / 60_000,
    withoutSteamMinutes: Math.max(0, totalMs - withSteamMs) / 60_000,
    withSteamPercent: totalMs > 0 ? (withSteamMs / totalMs) * 100 : 0,
  };
}

export function pressureSegments(interval: SteamIntervalLike) {
  const readings = [...(interval.pressureReadings ?? [])].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  return readings.map((reading, index) => ({
    from: new Date(reading.occurredAt),
    to: new Date(index + 1 < readings.length ? readings[index + 1].occurredAt : interval.endedAt ?? new Date()),
    psi: Number(reading.canonicalPsi),
  }));
}
