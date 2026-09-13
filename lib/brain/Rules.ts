import { BrainDecision } from "./Types";
import { MaestroKnowledge } from "./Knowledge";

export type ProcessInput = {
  temperature?: number;
  ph?: number;
  brix?: number;
  alcohol?: number;
  hours?: number;
};

export class Rules {
  static cooking(input: ProcessInput): BrainDecision[] {
    const decisions: BrainDecision[] = [];

    if (
      input.temperature !== undefined &&
      input.temperature < MaestroKnowledge.cooking.minTemperatureC
    ) {
      decisions.push({
        priority: "ALTA",
        area: "COCCION",
        title: "Temperatura baja",
        summary:
          "La temperatura está por debajo del mínimo recomendado para una buena cocción.",
        actions: [
          "Incrementar ligeramente la inyección de vapor.",
          "Verificar los tres puntos de medición.",
        ],
        confidence: 98,
      });
    }

    if (
      input.temperature !== undefined &&
      input.temperature > MaestroKnowledge.cooking.maxTemperatureC
    ) {
      decisions.push({
        priority: "MEDIA",
        area: "COCCION",
        title: "Temperatura elevada",
        summary: "Existe riesgo de sobrecalentamiento y caramelización.",
        actions: [
          "Reducir ligeramente el vapor.",
          "Supervisar el color y aroma de las mieles.",
        ],
        confidence: 92,
      });
    }

    return decisions;
  }

  static fermentation(input: ProcessInput): BrainDecision[] {
    const decisions: BrainDecision[] = [];

    if (
      input.ph !== undefined &&
      input.ph > MaestroKnowledge.fermentation.idealPh.max
    ) {
      decisions.push({
        priority: "ALTA",
        area: "FERMENTACION",
        title: "pH elevado",
        summary:
          "La fermentación presenta un pH superior al rango recomendado.",
        actions: [
          "Revisar posible contaminación.",
          "Verificar el descenso del Brix.",
        ],
        confidence: 96,
      });
    }

    if (
      input.alcohol !== undefined &&
      input.alcohol < MaestroKnowledge.fermentation.targetAlcoholPercent.min
    ) {
      decisions.push({
        priority: "MEDIA",
        area: "FERMENTACION",
        title: "Alcohol inferior al esperado",
        summary:
          "La fermentación aún no alcanza el nivel de alcohol objetivo.",
        actions: [
          "Esperar antes de destilar.",
          "Registrar una nueva lectura en unas horas.",
        ],
        confidence: 90,
      });
    }

    return decisions;
  }
}