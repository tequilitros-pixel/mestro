export type EventConsumptionItem = {
  productId: string;
  name: string;
  category: string;
  unit: string;
  itemType: string;
  sent: number;
  returned: number;
  damaged: number;
  returnedOpenBase: number;
  contentPerUnit: number | null;
  contentUnit: string | null;
  unitCost: number | null;
};

export type EventConsumptionRow = {
  key: string;
  productId: string;
  name: string;
  category: string;
  unit: string;
  sent: number;
  returned: number;
  damaged: number;
  consumed: number;
  consumedLiters: number | null;
  consumedCost: number;
  costKnown: boolean;
};

function basePerUnit(item: EventConsumptionItem) {
  const unit = item.unit.trim().toLocaleLowerCase("es-MX");
  if (["l", "lt", "litro", "litros", "kg", "kilogramo", "kilogramos"].includes(unit)) return 1000;
  if (["ml", "mililitro", "mililitros", "g", "gr", "gramo", "gramos", "pza", "pieza", "piezas", "unidad", "unidades"].includes(unit)) return 1;
  const content = item.contentPerUnit;
  if (content !== null && content > 0) {
    if (item.contentUnit === "L" || item.contentUnit === "KG") return content * 1000;
    if (["ML", "G", "PIEZAS"].includes(item.contentUnit ?? "")) return content;
  }
  return 1;
}

function liquidLiters(item: EventConsumptionItem, consumed: number) {
  const contentUnit = item.contentUnit;
  if (contentUnit === "L" || contentUnit === "ML") {
    return consumed * basePerUnit(item) / 1000;
  }
  const unit = item.unit.trim().toLocaleLowerCase("es-MX");
  if (["l", "lt", "litro", "litros"].includes(unit)) return consumed;
  if (["ml", "mililitro", "mililitros"].includes(unit)) return consumed / 1000;
  return null;
}

/** Estimates use dispatched stock minus sealed/open returns and recorded damage.
 * They do not identify which prepared cocktail used an ingredient. */
export function buildEventConsumption(items: EventConsumptionItem[]): EventConsumptionRow[] {
  const byProduct = new Map<string, EventConsumptionRow>();
  for (const item of items) {
    if (item.itemType === "EQUIPMENT") continue;
    const factor = basePerUnit(item);
    const consumed = Math.max(item.sent - item.returned - item.damaged - item.returnedOpenBase / factor, 0);
    const liters = liquidLiters(item, consumed);
    const cost = consumed * (item.unitCost ?? 0);
    const key = `${item.productId}:${item.unit}:${item.contentPerUnit ?? ""}:${item.contentUnit ?? ""}`;
    const row = byProduct.get(key) ?? {
      key,
      productId: item.productId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      sent: 0,
      returned: 0,
      damaged: 0,
      consumed: 0,
      consumedLiters: null,
      consumedCost: 0,
      costKnown: true,
    };
    row.sent += item.sent;
    row.returned += item.returned;
    row.damaged += item.damaged;
    row.consumed += consumed;
    row.consumedCost += cost;
    if (consumed > 0 && item.unitCost === null) row.costKnown = false;
    if (liters !== null) row.consumedLiters = (row.consumedLiters ?? 0) + liters;
    byProduct.set(key, row);
  }
  return [...byProduct.values()]
    .map((row) => ({
      ...row,
      sent: Math.round(row.sent * 1000) / 1000,
      returned: Math.round(row.returned * 1000) / 1000,
      damaged: Math.round(row.damaged * 1000) / 1000,
      consumed: Math.round(row.consumed * 1000) / 1000,
      consumedLiters: row.consumedLiters === null ? null : Math.round(row.consumedLiters * 1000) / 1000,
      consumedCost: Math.round(row.consumedCost * 100) / 100,
    }))
    .sort((a, b) => b.consumedCost - a.consumedCost || a.name.localeCompare(b.name, "es-MX"));
}
