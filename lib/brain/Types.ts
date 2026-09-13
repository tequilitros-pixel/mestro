export type Priority = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export type BrainArea =
  | "COCCION"
  | "MOLIENDA"
  | "FERMENTACION"
  | "DESTILACION"
  | "COSTOS"
  | "CALIDAD"
  | "GENERAL";

export type BrainDecision = {
  priority: Priority;
  area: BrainArea;
  title: string;
  summary: string;
  actions: string[];
  confidence: number;
};