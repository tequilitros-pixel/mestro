export type PredictionInput = {
  agaveKg?: number;
  mustLiters?: number;
  alcoholPercent?: number;
  expectedEfficiency?: number;
  totalCost?: number;
};

export type PredictionResult = {
  expectedLiters: number;
  expectedCostPerLiter: number | null;
  confidence: number;
  explanation: string;
};

export class Predictor {
  static production(input: PredictionInput): PredictionResult {
    const alcohol = input.alcoholPercent ?? 6.5;
    const mustLiters = input.mustLiters ?? 0;
    const efficiency = input.expectedEfficiency ?? 0.72;

    const absoluteAlcohol = mustLiters * (alcohol / 100);

    const expectedLiters = absoluteAlcohol * efficiency;

    const expectedCostPerLiter =
      input.totalCost && expectedLiters > 0
        ? input.totalCost / expectedLiters
        : null;

    return {
      expectedLiters,
      expectedCostPerLiter,
      confidence: mustLiters > 0 ? 85 : 30,
      explanation:
        "Predicción basada en volumen de mosto, alcohol estimado y eficiencia esperada.",
    };
  }

  static fromAgave(input: PredictionInput): PredictionResult {
    const agaveKg = input.agaveKg ?? 0;

    // Referencia inicial: litros esperados aproximados por kg de agave.
    // Luego lo ajustaremos con datos reales históricos de MAESTRO.
    const expectedLiters = agaveKg * 0.155;

    const expectedCostPerLiter =
      input.totalCost && expectedLiters > 0
        ? input.totalCost / expectedLiters
        : null;

    return {
      expectedLiters,
      expectedCostPerLiter,
      confidence: agaveKg > 0 ? 70 : 25,
      explanation:
        "Predicción inicial basada en kilos de agave. Se volverá más precisa con el historial de lotes.",
    };
  }
}