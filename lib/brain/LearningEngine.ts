import { getLotHistory } from "./data/getLotHistory";
import { ExcellenceEngine } from "./ExcellenceEngine";

export async function summary() {
  const lots = await getLotHistory();

  if (lots.length === 0) {
    return {
      totalLots: 0,
      averageScore: 0,
      averageExtraction: 0,
      bestLot: null,
      recommendation: "Aún no existen suficientes datos para aprender.",
    };
  }

  const scoredLots = lots.map((lot) => {
    const evaluation = ExcellenceEngine.evaluate({
      cookingTemp: lot.cookingTemp ?? undefined,
      fermentationAlcohol: lot.alcohol ?? undefined,
      extraction: lot.extraction ?? undefined,
    });
    return { ...lot, score: evaluation.score };
  });

  const averageScore =
    scoredLots.reduce((s, l) => s + l.score, 0) / scoredLots.length;

  const extractionValues = lots
    .map((l) => l.extraction)
    .filter((e): e is number => e != null);

  const averageExtraction =
    extractionValues.length > 0
      ? extractionValues.reduce((s, e) => s + e, 0) / extractionValues.length
      : 0;

  const bestLot = [...scoredLots].sort((a, b) => b.score - a.score)[0];

  let recommendation = "Proceso estable.";

  if (averageExtraction > 0 && averageExtraction < 85) {
    recommendation =
      "MAESTRO recomienda mejorar la extracción durante la molienda.";
  } else if (averageScore > 95) {
    recommendation = "Excelente consistencia. Mantener el proceso actual.";
  }

  return {
    totalLots: lots.length,
    averageScore,
    averageExtraction,
    bestLot,
    recommendation,
  };
}

export class LearningEngine {
  static summary = summary;
}
