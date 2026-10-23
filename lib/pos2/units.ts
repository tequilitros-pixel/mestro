import type { CatalogBaseUnit } from "@prisma/client";
import type { QuantityUnit } from "@/lib/domain/quantity";

export function quantityUnitFromCatalogBaseUnit(unit: CatalogBaseUnit): QuantityUnit {
  switch (unit) {
    case "UNIT": return "UNIT";
    case "ML": return "ML";
    case "G": return "G";
    default: { const unreachable: never = unit; throw new Error(`Unsupported catalog base unit: ${unreachable}`); }
  }
}
