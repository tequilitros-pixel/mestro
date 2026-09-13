import { MaestroKnowledge } from "./Knowledge";

export type ExcellenceInput = {
  cookingTemp?: number;
  fermentationAlcohol?: number;
  extraction?: number;
};

export type ExcellenceResult = {
  score: number;
  level: string;
  explanation: string;
};

export class ExcellenceEngine {
  static evaluate(input: ExcellenceInput): ExcellenceResult {
    let score = 100;

    if (
      input.cookingTemp &&
      Math.abs(
        input.cookingTemp -
          MaestroKnowledge.cooking.idealTemperatureC
      ) > 2
    ) {
      score -= 8;
    }

    if (
      input.fermentationAlcohol &&
      input.fermentationAlcohol <
        MaestroKnowledge.fermentation.targetAlcoholPercent.min
    ) {
      score -= 12;
    }

    if (
      input.extraction &&
      input.extraction <
        MaestroKnowledge.milling.targetExtractionPercent
    ) {
      score -= 10;
    }

    let level = "Excelente";

    if (score < 95) level = "Muy bueno";
    if (score < 85) level = "Bueno";
    if (score < 75) level = "Regular";
    if (score < 60) level = "Crítico";

    return {
      score,
      level,
      explanation:
        "Evaluación integral del lote realizada por MAESTRO.",
    };
  }
}