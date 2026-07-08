export type RiskLevel =
  | "BAJO"
  | "MEDIO"
  | "ALTO"
  | "CRITICO";

export interface Thought {

  timestamp: Date;

  summary: string;

  priority: string;

  risk: RiskLevel;

  confidence: number;

  recommendations: string[];

  alerts: string[];

  expectedProduction: number;

  expectedCostPerLiter: number;

  operatingEquipment: number;

  totalEquipment: number;

  learning: string[];

}