import type { OfflineOperation } from "./types";

type ProductionOperationKind = Extract<
  OfflineOperation["kind"],
  | "cooking.event.create"
  | "boiler.session.start"
  | "boiler.session.stop"
  | "boiler.gas.reading.create"
  | "boiler.pressure.reading.create"
  | "boiler.event.create"
  | "boiler.maintenance.create"
  | "boiler.incident.create"
  | "steam.interval.start"
  | "steam.pressure.create"
  | "steam.interval.stop"
  | "sweet-honey.recovery.create"
  | "milling.discharge.create"
  | "fermentation.reading.create"
  | "distillation.event.create"
>;

const MODULE_BY_OPERATION: Record<ProductionOperationKind, string> = {
  "cooking.event.create": "/cooking",
  "boiler.session.start": "/boiler",
  "boiler.session.stop": "/boiler",
  "boiler.gas.reading.create": "/boiler",
  "boiler.pressure.reading.create": "/boiler",
  "boiler.event.create": "/boiler",
  "boiler.maintenance.create": "/boiler",
  "boiler.incident.create": "/boiler",
  "steam.interval.start": "/cooking",
  "steam.pressure.create": "/cooking",
  "steam.interval.stop": "/cooking",
  "sweet-honey.recovery.create": "/cooking",
  "milling.discharge.create": "/milling",
  "fermentation.reading.create": "/fermentation",
  "distillation.event.create": "/distillation",
};

export function getProductionOperationModuleKey(kind: OfflineOperation["kind"]) {
  return MODULE_BY_OPERATION[kind as ProductionOperationKind] ?? null;
}
