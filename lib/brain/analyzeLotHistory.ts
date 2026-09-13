import { getLotHistory, HistoricLot } from "./data/getLotHistory";

export type LotComparison = {
  lots: HistoricLot[];
  averageExtraction: number | null;
  averageCookingHours: number | null;
  averageCostPerLiter: number | null;
  bestLot: HistoricLot | null;
  worstLot: HistoricLot | null;
  trend: {
    extraction: "MEJORANDO" | "EMPEORANDO" | "ESTABLE" | "SIN_DATOS";
    costPerLiter: "MEJORANDO" | "EMPEORANDO" | "ESTABLE" | "SIN_DATOS";
  };
};

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function compareTrend(
  lots: HistoricLot[],
  key: "extraction" | "costPerLiter"
): "MEJORANDO" | "EMPEORANDO" | "ESTABLE" | "SIN_DATOS" {
  const valid = lots.filter((l) => l[key] != null);
  if (valid.length < 2) return "SIN_DATOS";

  const half = Math.floor(valid.length / 2);
  const firstHalf = valid.slice(0, half);
  const secondHalf = valid.slice(half);

  const firstAvg = average(firstHalf.map((l) => l[key]));
  const secondAvg = average(secondHalf.map((l) => l[key]));

  if (firstAvg == null || secondAvg == null) return "SIN_DATOS";

  const diff = secondAvg - firstAvg;
  const threshold = firstAvg * 0.03; // 3% de cambio para considerarlo relevante

  if (Math.abs(diff) < threshold) return "ESTABLE";

  // Para extracción, subir es bueno. Para costo por litro, bajar es bueno.
  if (key === "extraction") {
    return diff > 0 ? "MEJORANDO" : "EMPEORANDO";
  } else {
    return diff < 0 ? "MEJORANDO" : "EMPEORANDO";
  }
}

export async function analyzeLotHistory(): Promise<LotComparison> {
  const lots = await getLotHistory();

  if (lots.length === 0) {
    return {
      lots: [],
      averageExtraction: null,
      averageCookingHours: null,
      averageCostPerLiter: null,
      bestLot: null,
      worstLot: null,
      trend: {
        extraction: "SIN_DATOS",
        costPerLiter: "SIN_DATOS",
      },
    };
  }

  const averageExtraction = average(lots.map((l) => l.extraction));
  const averageCookingHours = average(lots.map((l) => l.cookingHours));
  const averageCostPerLiter = average(lots.map((l) => l.costPerLiter));

  const lotsWithLiters = lots.filter((l) => l.litersProduced != null);
  const bestLot =
    lotsWithLiters.length > 0
      ? [...lotsWithLiters].sort(
          (a, b) => (b.litersProduced ?? 0) - (a.litersProduced ?? 0)
        )[0]
      : null;
  const worstLot =
    lotsWithLiters.length > 0
      ? [...lotsWithLiters].sort(
          (a, b) => (a.litersProduced ?? 0) - (b.litersProduced ?? 0)
        )[0]
      : null;

  return {
    lots,
    averageExtraction,
    averageCookingHours,
    averageCostPerLiter,
    bestLot,
    worstLot,
    trend: {
      extraction: compareTrend(lots, "extraction"),
      costPerLiter: compareTrend(lots, "costPerLiter"),
    },
  };
}
