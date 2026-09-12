export type InventoryProductUnitConfig = {
  productName?: string | null;
  itemLabel?: string | null;
  trackStock?: boolean;
  itemType?: string | null;
  inventoryBaseUnit?: string | null;
  handlingUnit?: string | null;
  contentPerUnit?: unknown;
  contentUnit?: string | null;
  normalizedContentPerUnit?: unknown;
};

const multipliers: Record<string, number> = { ML: 1, L: 1000, G: 1, KG: 1000, PIEZAS: 1 };

function pluralizeSpanish(value: string) {
  const word = value.trim().toLocaleLowerCase("es-MX");
  if (!word) return "piezas";
  if (word.endsWith("s")) return word;
  if (word.endsWith("z")) return `${word.slice(0, -1)}ces`;
  return `${word}${/[aeiouáéíóú]$/.test(word) ? "s" : "es"}`;
}

function singularizeSpanish(value: string) {
  if (value.endsWith("ces")) return `${value.slice(0, -3)}z`;
  if (value.endsWith("es") && value.length > 3) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 2) return value.slice(0, -1);
  return value;
}

function contentLabel(config: InventoryProductUnitConfig, contentUnit: string) {
  if (config.itemLabel) return config.itemLabel.toLocaleLowerCase("es-MX");
  if (contentUnit === "PIEZAS" && config.productName) {
    return pluralizeSpanish(config.productName.split(/\s+/)[0]);
  }
  return contentUnit.toLocaleLowerCase("es-MX");
}

export function formatCommercialPresentation(config: InventoryProductUnitConfig): string | null {
  const content = Number(config.contentPerUnit);
  const contentUnit = config.contentUnit?.toUpperCase();
  const handling = config.handlingUnit?.toUpperCase();
  if (!Number.isFinite(content) || content <= 0 || !contentUnit || !handling) return null;
  const handlingLabel = handling.toLocaleLowerCase("es-MX");
  return `${handlingLabel.charAt(0).toLocaleUpperCase("es-MX")}${handlingLabel.slice(1)} de ${content.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${contentLabel(config, contentUnit)}`;
}

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
    const contentUnit = config.contentUnit?.toUpperCase() ?? "PIEZAS";
    const itemLabel = contentLabel(config, contentUnit);
    const packages = Math.floor(quantity / content);
    const remainder = quantity - packages * content;
    const packageLabel = `${packages} ${handling}${packages === 1 ? "" : "s"}`;
    const quantityLabel = (value: number) => `${value.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${value === 1 ? singularizeSpanish(itemLabel) : itemLabel}`;
    const remainderLabel = quantityLabel(remainder);
    return remainder === 0 && packages > 0
      ? `${packageLabel} (${quantityLabel(quantity)})`
      : `${quantityLabel(quantity)} (${packageLabel} + ${remainderLabel})`;
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
