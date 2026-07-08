import { PlantModel } from "./PlantModel";
import { ProductionEngineer } from "./specialists/ProductionEngineer";
import { Thought } from "./Thought";

export class PlantBrain {
  static think(): Thought {
    const production = ProductionEngineer.analyze();
    const operating = PlantModel.operating();

    return {
      timestamp: new Date(),

      summary:
        operating.length === 0
          ? "La planta se encuentra detenida."
          : "La planta opera normalmente.",

      priority:
        production.actions.length > 0
          ? production.actions[0]
          : "Sin acciones pendientes.",

      risk: production.alerts.length > 0 ? "MEDIO" : "BAJO",

      confidence: 96,

      recommendations: production.actions,

      alerts: production.alerts,

      expectedProduction: production.expectedLiters,

      expectedCostPerLiter: 40,

      operatingEquipment: operating.length,

      totalEquipment: PlantModel.all().length,

      learning: ["La planta continúa aprendiendo del historial."],
    };
  }
}