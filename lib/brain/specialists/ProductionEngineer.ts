import { analyzeActiveProcesses } from "../analyzeActiveProcesses";
import { Predictor } from "../Predictor";
import { getActiveProcesses } from "../data/getActiveProcesses";

export class ProductionEngineer {
  static async analyze() {
    const { alerts, recommendations } = await analyzeActiveProcesses();
    const { cookings } = await getActiveProcesses();

    const totalAgaveKg = cookings.reduce((sum, c) => sum + c.agaveKg, 0);

    const prediction = Predictor.fromAgave({
      agaveKg: totalAgaveKg,
    });

    return {
      priority: alerts.length > 0 ? "ALTA" : "NORMAL",
      expectedLiters: prediction.expectedLiters,
      alerts: alerts.map((a) => `${a.source}: ${a.message}`),
      actions: recommendations,
    };
  }
}
