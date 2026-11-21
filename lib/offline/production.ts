import type { OfflineOperation } from "./types";

type ProductionOperationKind = Extract<
  OfflineOperation["kind"],
  | "cooking.event.create"
  | "milling.discharge.create"
  | "fermentation.reading.create"
  | "distillation.event.create"
  | "liquor.batch.create"
  | "liquor.batch.step.complete"
  | "liquor.bottling.create"
>;

const MODULE_BY_OPERATION: Record<ProductionOperationKind, string> = {
  "cooking.event.create": "/cooking",
  "milling.discharge.create": "/milling",
  "fermentation.reading.create": "/fermentation",
  "distillation.event.create": "/distillation",
  "liquor.batch.create": "/liquors/batches",
  "liquor.batch.step.complete": "/liquors/batches",
  "liquor.bottling.create": "/liquors/bottling",
};

export function getProductionOperationModuleKey(kind: OfflineOperation["kind"]) {
  return MODULE_BY_OPERATION[kind as ProductionOperationKind] ?? null;
}
