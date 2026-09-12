export type InventoryProductUnitConfig = {
  productName?: string | null;
  unit?: string | null;
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
const contentUnitBase: Record<string, string> = {
  ML: "ML",
  L: "ML",
  G: "G",
  KG: "G",
  PIEZAS: "UNIT",
};
const baseUnitLabels: Record<string, string> = {
  UNIT: "unidad",
  ML: "ml",
  G: "g",
};

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

function formatNumber(value: number) {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 3 });
}

function formatUnitLabel(value: number, unit: string) {
  const label = unit.trim().toLocaleLowerCase("es-MX") || "unidad";
  const magnitude = Math.abs(value);
  const singular = magnitude > 0 && magnitude <= 1;
  return singular ? singularizeSpanish(label) : pluralizeSpanish(label);
}

function getNormalizedContentPerUnit(config: InventoryProductUnitConfig) {
  const base = config.inventoryBaseUnit?.trim().toUpperCase();
  const contentUnit = config.contentUnit?.trim().toUpperCase();
  const multiplier = contentUnit ? multipliers[contentUnit] : undefined;

  if (
    !base ||
    !contentUnit ||
    !multiplier ||
    contentUnitBase[contentUnit] !== base
  ) {
    return null;
  }

  const content = Number(config.contentPerUnit);
  if (!Number.isFinite(content) || content <= 0) return null;

  const derived = content * multiplier;
  const configured = config.normalizedContentPerUnit;
  if (configured !== null && configured !== undefined && String(configured).trim() !== "") {
    const normalized = Number(configured);
    const tolerance = Math.max(1e-9, Math.abs(derived) * 1e-9);
    if (!Number.isFinite(normalized) || normalized <= 0 || Math.abs(normalized - derived) > tolerance) {
      return null;
    }
    return normalized;
  }

  return derived;
}

function formatBaseQuantity(quantity: number, config: InventoryProductUnitConfig) {
  const base = config.inventoryBaseUnit?.trim().toUpperCase();
  const baseLabel = baseUnitLabels[base ?? ""];
  if (baseLabel) {
    const quantityUnit = base === "UNIT" ? formatUnitLabel(quantity, baseLabel) : baseLabel;
    return `${formatNumber(quantity)} ${quantityUnit} · Presentación por configurar`;
  }

  const fallbackUnit = config.unit?.trim() || "unidad base";
  return `${formatNumber(quantity)} ${fallbackUnit} · Presentación por configurar`;
}

export function hasValidCommercialConversion(config: InventoryProductUnitConfig) {
  return Boolean(config.handlingUnit?.trim()) && getNormalizedContentPerUnit(config) !== null;
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
  const content = getNormalizedContentPerUnit(config);
  const handling = config.handlingUnit?.trim().toLocaleLowerCase("es-MX");
  if (!content || !handling) return formatBaseQuantity(quantity, config);

  const commercialQuantity = quantity / content;
  const base = config.inventoryBaseUnit?.trim().toUpperCase();
  const contentUnit = config.contentUnit?.trim().toUpperCase();

  if (
    base === "UNIT" &&
    contentUnit === "PIEZAS" &&
    handling !== "pieza" &&
    quantity > 0
  ) {
    const contentUnit = config.contentUnit?.toUpperCase() ?? "PIEZAS";
    const itemLabel = contentLabel(config, contentUnit);
    const packages = Math.floor(quantity / content);
    const remainder = quantity - packages * content;
    const packageLabel = `${packages} ${handling}${packages === 1 ? "" : "s"}`;
    const quantityLabel = (value: number) => `${formatNumber(value)} ${value === 1 ? singularizeSpanish(itemLabel) : itemLabel}`;
    const remainderLabel = quantityLabel(remainder);
    return remainder === 0 && packages > 0
      ? `${packageLabel} (${quantityLabel(quantity)})`
      : `${quantityLabel(quantity)} (${packageLabel} + ${remainderLabel})`;
  }

  return `${formatNumber(commercialQuantity)} ${formatUnitLabel(commercialQuantity, handling)}`;
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
