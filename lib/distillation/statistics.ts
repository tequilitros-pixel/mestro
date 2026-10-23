export type DistillationStatisticInput = {
  id: string;
  tankName: string;
  equipmentName: string;
  loadedLiters: number;
  finalLiters: number | null;
  finalAlcohol: number | null;
  finalHeadsLiters: number | null;
  finalHeartLiters: number | null;
  finalTailsLiters: number | null;
};

export function summarizeDistillations(items: DistillationStatisticInput[]) {
  const grouped = new Map<string, {
    tankName: string;
    loadedLiters: number;
    finalLiters: number;
    absoluteAlcoholLiters: number;
    headsLiters: number;
    heartLiters: number;
    tailsLiters: number;
    runs: DistillationStatisticInput[];
  }>();

  for (const item of items) {
    const group = grouped.get(item.tankName) ?? {
      tankName: item.tankName,
      loadedLiters: 0,
      finalLiters: 0,
      absoluteAlcoholLiters: 0,
      headsLiters: 0,
      heartLiters: 0,
      tailsLiters: 0,
      runs: [],
    };
    const finalLiters = item.finalLiters ?? 0;
    group.loadedLiters += item.loadedLiters;
    group.finalLiters += finalLiters;
    group.absoluteAlcoholLiters += finalLiters * ((item.finalAlcohol ?? 0) / 100);
    group.headsLiters += item.finalHeadsLiters ?? 0;
    group.heartLiters += item.finalHeartLiters ?? 0;
    group.tailsLiters += item.finalTailsLiters ?? 0;
    group.runs.push(item);
    grouped.set(item.tankName, group);
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    averageAlcohol: group.finalLiters > 0
      ? (group.absoluteAlcoholLiters / group.finalLiters) * 100
      : null,
    yieldPercent: group.loadedLiters > 0
      ? (group.finalLiters / group.loadedLiters) * 100
      : 0,
  }));
}
