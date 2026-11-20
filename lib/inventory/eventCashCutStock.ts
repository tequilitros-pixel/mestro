import "server-only";
import { Prisma, type CatalogBaseUnit, type InventoryProduct } from "@prisma/client";
import { normalizeManualInventoryQuantity } from "@/lib/inventory/manualMovements";

type Tx = Prisma.TransactionClient;
type EventItem = {
  productId: string; productName: string; unit: string;
  sentQuantity: Prisma.Decimal | null; plannedQuantity: Prisma.Decimal;
  handlingUnit: InventoryProduct["handlingUnit"];
  contentPerUnit: Prisma.Decimal | null;
  contentUnit: InventoryProduct["contentUnit"];
};

export type EventOpeningWarning = {
  product: string;
  required: number;
  available: number;
  missing: number;
  unit: string;
  note?: string;
};

function eventItemAmount(item: EventItem, product: InventoryProduct) {
  const captured = new Prisma.Decimal(item.sentQuantity ?? item.plannedQuantity);
  if (!product.inventoryBaseUnit) return { amount: captured, factor: new Prisma.Decimal(1), unit: item.unit };
  const snapshot = {
    ...product,
    unit: item.unit,
    handlingUnit: item.handlingUnit,
    contentPerUnit: item.contentPerUnit,
    contentUnit: item.contentUnit,
    normalizedContentPerUnit: null,
  };
  const factor = normalizeManualInventoryQuantity(snapshot, 1);
  return { amount: captured.times(factor), factor, unit: item.unit };
}

/**
 * Preflight informativo de la sucursal origen. Nunca registra una salida ni
 * convierte el stock del evento en stock de la sucursal.
 */
export async function getEventOpeningWarnings(tx: Tx, eventItems: EventItem[], branchId: string): Promise<EventOpeningWarning[]> {
  const active = eventItems.filter((item) => Number(item.sentQuantity ?? item.plannedQuantity) > 0);
  const ids = [...new Set(active.map((item) => item.productId))];
  if (!ids.length) return [];
  const [products, balances] = await Promise.all([
    tx.inventoryProduct.findMany({ where: { id: { in: ids } } }),
    tx.inventoryBalance.findMany({ where: { branchId, inventoryProductId: { in: ids } } }),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const balancesById = new Map(balances.map((balance) => [balance.inventoryProductId, balance]));
  const grouped = new Map<string, { required: Prisma.Decimal; factor: Prisma.Decimal; unit: string; name: string; isV2: boolean }>();
  const warnings: EventOpeningWarning[] = [];

  for (const item of active) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    try {
      const normalized = eventItemAmount(item, product);
      const previous = grouped.get(item.productId);
      if (previous) previous.required = previous.required.plus(normalized.amount);
      else grouped.set(item.productId, { required: normalized.amount, factor: normalized.factor, unit: normalized.unit, name: item.productName, isV2: Boolean(product.inventoryBaseUnit) });
    } catch {
      // Una presentación desconfigurada debe aparecer como aviso, no bloquear caja.
      warnings.push({ product: item.productName, required: Number(item.sentQuantity ?? item.plannedQuantity), available: 0, missing: Number(item.sentQuantity ?? item.plannedQuantity), unit: item.unit, note: "Revisar conversión de unidad" });
    }
  }

  for (const [productId, needed] of grouped) {
    let available = new Prisma.Decimal(0);
    if (needed.isV2) {
      available = new Prisma.Decimal(balancesById.get(productId)?.quantity ?? 0);
    } else {
      const count = await tx.inventoryCount.findFirst({
        where: { branchId, status: "CERRADO", items: { some: { productId } } },
        orderBy: [{ countDate: "desc" }, { id: "desc" }],
        include: { items: { where: { productId } } },
      });
      const entries = await tx.inventoryEntry.aggregate({
        where: { branchId, productId, entryDate: { gt: count?.countDate ?? new Date(0) } },
        _sum: { quantity: true },
      });
      available = new Prisma.Decimal(count?.items[0]?.quantityCounted ?? 0).plus(entries._sum.quantity ?? 0);
    }
    const missing = needed.required.minus(available);
    if (missing.greaterThan(0)) {
      const factor = needed.factor;
      warnings.push({
        product: needed.name,
        required: needed.required.div(factor).toDecimalPlaces(3).toNumber(),
        available: available.div(factor).toDecimalPlaces(3).toNumber(),
        missing: missing.div(factor).toDecimalPlaces(3).toNumber(),
        unit: needed.unit,
      });
    }
  }
  return warnings.sort((a, b) => a.product.localeCompare(b.product, "es"));
}

/** Un cobro de evento consume únicamente su manifiesto, no el saldo de Barra. */
export async function recordEventSaleConsumption(tx: Tx, input: {
  eventId: string;
  saleId: string;
  requirements: Array<{ inventoryProductId: string; quantity: Prisma.Decimal | number | string; unit?: CatalogBaseUnit | null }>;
}) {
  const ids = [...new Set(input.requirements.map((item) => item.inventoryProductId))];
  if (!ids.length) return;
  const products = await tx.inventoryProduct.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  const grouped = new Map<string, { quantity: Prisma.Decimal; unit: string }>();

  for (const item of input.requirements) {
    const product = byId.get(item.inventoryProductId);
    if (!product) throw new Error("El ingrediente de la receta ya no existe.");
    const inputQuantity = new Prisma.Decimal(item.quantity);
    if (inputQuantity.lessThanOrEqualTo(0)) continue;
    // Las recetas V2 expresan cantidad en la unidad base; las recetas
    // históricas sin unidad mantienen su magnitud original y quedan trazadas.
    const amount = item.unit || !product.inventoryBaseUnit
      ? inputQuantity
      : normalizeManualInventoryQuantity(product, inputQuantity.toNumber());
    const unit = item.unit ?? product.inventoryBaseUnit ?? product.unit;
    const previous = grouped.get(item.inventoryProductId);
    if (previous && previous.unit !== unit) throw new Error("La receta mezcla unidades del mismo ingrediente.");
    grouped.set(item.inventoryProductId, {
      quantity: (previous?.quantity ?? new Prisma.Decimal(0)).plus(amount),
      unit,
    });
  }

  if (!grouped.size) return;
  await tx.eventSaleConsumption.createMany({
    data: [...grouped.entries()].map(([productId, row]) => ({
      eventId: input.eventId,
      saleId: input.saleId,
      productId,
      quantity: row.quantity,
      unit: row.unit,
    })),
  });
}
