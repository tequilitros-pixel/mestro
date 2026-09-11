export type InventoryProductUnitConfig = {
  trackStock?: boolean;
  itemType?: string | null;
  inventoryBaseUnit?: string | null;
  handlingUnit?: string | null;
  contentPerUnit?: unknown;
  contentUnit?: string | null;
  normalizedContentPerUnit?: unknown;
};

const multipliers: Record<string, number> = { ML: 1, L: 1000, G: 1, KG: 1000, PIEZAS: 1 };

export function formatCommercialQuantity(
  baseQuantity: number | string,
  config: InventoryProductUnitConfig,
): string {
  const quantity = Number(baseQuantity);
  if (!Number.isFinite(quantity)) return "—";
  const base = config.inventoryBaseUnit?.toUpperCase();
  const content = Number(config.normalizedContentPerUnit ?? config.contentPerUnit);
  const handling = (config.handlingUnit ?? "unidad").toLowerCase();
  if (base === "UNIT" && Number.isFinite(content) && content > 0 && handling !== "pieza") {
    const pieces = quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 });
    const packages = Math.floor(quantity / content);
    const remainder = quantity - packages * content;
    const packageLabel = `${packages} ${handling}${packages === 1 ? "" : "s"}`;
    const contentLabel = `${content.toLocaleString("es-MX", { maximumFractionDigits: 3 })} piezas/${handling}`;
    return remainder === 0 && packages > 0
      ? `${packageLabel} (${pieces} piezas; ${contentLabel})`
      : `${pieces} piezas (${contentLabel})`;
  }
  if (base === "ML" && Number.isFinite(quantity)) {
    return `${(quantity / 1000).toLocaleString("es-MX", { maximumFractionDigits: 3 })} L (${quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ml)`;
  }
  return `${quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${base ?? handling}`;
}

export function normalizeCommercialQuantity(input: {
  closedUnits: number | string;
  openFraction?: number | string;
  config: InventoryProductUnitConfig;
}): number {
  const closed = Number(input.closedUnits);
  const fraction = Number(input.openFraction ?? 0);
  const contentUnit = input.config.contentUnit?.toUpperCase();
  const content = Number(input.config.contentPerUnit) * (multipliers[contentUnit ?? ""] ?? 1);
  if (!Number.isFinite(closed) || closed < 0 || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error("Cantidad inválida.");
  return closed * content + fraction * content;
}
