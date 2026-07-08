import { LotHistory } from "./LotHistory";

export class LearningEngine {
  static summary() {
    const lots = LotHistory.all();

    if (lots.length === 0) {
      return {
        totalLots: 0,
        averageScore: 0,
        averageExtraction: 0,
        bestLot: null,
        recommendation: "Aún no existen suficientes datos para aprender.",
      };
    }

    const averageScore = LotHistory.averageScore();
    const averageExtraction = LotHistory.averageExtraction();
    const bestLot = LotHistory.bestLot();

    let recommendation = "Proceso estable.";

    if (averageExtraction < 85) {
      recommendation =
        "MAESTRO recomienda mejorar la extracción durante la molienda.";
    } else if (averageScore > 95) {
      recommendation =
        "Excelente consistencia. Mantener el proceso actual.";
    }

    return {
      totalLots: lots.length,
      averageScore,
      averageExtraction,
      bestLot,
      recommendation,
    };
  }
}