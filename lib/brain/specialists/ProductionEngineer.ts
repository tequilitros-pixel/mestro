import { ProcessMonitor } from "../ProcessMonitor";
import { Predictor } from "../Predictor";

export class ProductionEngineer {
  static analyze() {
    const monitor = ProcessMonitor.analyze({
      cookingTemp: 92,
      cookingHours: 33,
      fermentationAlcohol: 5.4,
      fermentationPH: 4.6,
      extraction: 90,
    });

    const prediction = Predictor.fromAgave({
      agaveKg: 3500,
      totalCost: 22000,
    });

    return {
      priority: monitor.alerts.length > 0 ? "ALTA" : "NORMAL",
      expectedLiters: prediction.expectedLiters,
      alerts: monitor.alerts,
      actions: monitor.recommendations,
    };
  }
}