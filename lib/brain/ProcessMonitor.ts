import { MaestroKnowledge } from "./Knowledge";

type ProcessState = {
  cookingTemp?: number;
  cookingHours?: number;

  fermentationAlcohol?: number;
  fermentationPH?: number;
  fermentationTemp?: number;

  extraction?: number;
};

export class ProcessMonitor {
  static analyze(state: ProcessState) {
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Cocción
    if (state.cookingTemp !== undefined) {
      if (state.cookingTemp < MaestroKnowledge.cooking.minTemperatureC) {
        alerts.push("🔥 Temperatura baja en cocción.");
      }

      if (state.cookingTemp > MaestroKnowledge.cooking.maxTemperatureC) {
        alerts.push("🔥 Temperatura demasiado alta.");
      }
    }

    if (state.cookingHours !== undefined) {
      if (state.cookingHours > MaestroKnowledge.cooking.idealHours.max) {
        alerts.push("⏰ Posible sobrecocción.");
      }
    }

    // Fermentación

    if (
      state.fermentationAlcohol !== undefined &&
      state.fermentationAlcohol <
        MaestroKnowledge.fermentation.targetAlcoholPercent.min
    ) {
      recommendations.push(
        "Esperar antes de destilar. El alcohol aún puede aumentar."
      );
    }

    if (
      state.fermentationPH !== undefined &&
      state.fermentationPH >
        MaestroKnowledge.fermentation.idealPh.max
    ) {
      alerts.push("⚠ pH elevado.");
    }

    if (
      state.extraction !== undefined &&
      state.extraction <
        MaestroKnowledge.milling.targetExtractionPercent
    ) {
      recommendations.push(
        "Revisar presión de molienda o reprimir bagazo."
      );
    }

    return {
      alerts,
      recommendations,
    };
  }
}