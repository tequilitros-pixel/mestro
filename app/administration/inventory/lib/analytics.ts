import { prisma } from "@/lib/prisma";
import { computeStockMatrix, totalStockByProduct } from "./stock";

/**
 * Analítica del inventario para el tablero de inicio.
 *
 * Nota sobre el signo de las cantidades: en InventoryEntry las salidas
 * se guardan en negativo (venta POS, salida a evento) y las entradas en
 * positivo (compra, producción). Por eso el "consumo" de un producto es
 * la suma de sus movimientos negativos, en valor absoluto.
 */

const ANALYTICS_DAYS = 30;

/** Días sin movimiento a partir de los cuales un producto se marca como parado. */
const STALE_DAYS = 60;

const ENTRY_TYPE_LABELS: Record<string, string> = {
  COMPRA: "Compras",
  TRASPASO: "Traspasos",
  AJUSTE: "Ajustes",
  VENTA_POS: "Ventas POS",
  DEVOLUCION_POS: "Devoluciones POS",
  SALIDA_EVENTO: "Salidas a eventos",
  PRODUCCION: "Producción",
};

export type InventoryAnalytics = {
  days: number;

  totals: {
    products: number;
    activeProducts: number;
    movements: number;
    consumedUnits: number;
    receivedUnits: number;
    consumedCost: number;
    lowStockCount: number;
    outOfStockCount: number;
    staleCount: number;
  };

  topProducts: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
    unit: string;
    consumed: number;
    received: number;
    movements: number;
    cost: number;
    stock: number;
    minimumStock: number;
    daysOfCover: number | null;
  }>;

  categories: Array<{
    name: string;
    consumed: number;
    cost: number;
    products: number;
    movements: number;
  }>;

  branches: Array<{
    id: string;
    name: string;
    consumed: number;
    cost: number;
    movements: number;
  }>;

  movementTypes: Array<{ name: string; movements: number; units: number }>;

  daily: Array<{ date: string; label: string; consumed: number; received: number }>;

  lowStock: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    minimumStock: number;
    consumed: number;
    daysOfCover: number | null;
  }>;

  stale: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    lastMovement: string | null;
  }>;
};

export async function getInventoryAnalytics(
  days = ANALYTICS_DAYS,
): Promise<InventoryAnalytics> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const staleSince = new Date();
  staleSince.setDate(staleSince.getDate() - STALE_DAYS);

  const [products, entries, lastMovements] = await Promise.all([
    prisma.inventoryProduct.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        unitCost: true,
        minimumStock: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.inventoryEntry.findMany({
      where: { entryDate: { gte: since } },
      select: {
        productId: true,
        branchId: true,
        type: true,
        quantity: true,
        unitCost: true,
        entryDate: true,
        branch: { select: { id: true, name: true } },
      },
    }),

    // Último movimiento de cada producto, para detectar inventario parado.
    prisma.inventoryEntry.groupBy({
      by: ["productId"],
      _max: { entryDate: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));

  const lastMovementByProduct = new Map(
    lastMovements.map((m) => [m.productId, m._max.entryDate]),
  );

  const stockMatrix = await computeStockMatrix(products.map((p) => p.id));

  type ProductAcc = {
    consumed: number;
    received: number;
    movements: number;
    cost: number;
  };

  const productAcc = new Map<string, ProductAcc>();
  const categoryAcc = new Map<
    string,
    { consumed: number; cost: number; products: Set<string>; movements: number }
  >();
  const branchAcc = new Map<
    string,
    { id: string; name: string; consumed: number; cost: number; movements: number }
  >();
  const typeAcc = new Map<string, { movements: number; units: number }>();
  const dailyAcc = new Map<string, { consumed: number; received: number }>();

  let totalConsumed = 0;
  let totalReceived = 0;
  let totalConsumedCost = 0;

  for (const entry of entries) {
    const product = productById.get(entry.productId);
    if (!product) continue;

    const quantity = Number(entry.quantity);
    const consumed = quantity < 0 ? Math.abs(quantity) : 0;
    const received = quantity > 0 ? quantity : 0;

    // El costo del movimiento usa el costo capturado en la entrada y,
    // si no lo trae, el costo unitario del catálogo.
    const unitCost =
      entry.unitCost !== null
        ? Number(entry.unitCost)
        : product.unitCost !== null
          ? Number(product.unitCost)
          : 0;

    const cost = consumed * unitCost;

    totalConsumed += consumed;
    totalReceived += received;
    totalConsumedCost += cost;

    const acc =
      productAcc.get(entry.productId) ??
      { consumed: 0, received: 0, movements: 0, cost: 0 };
    acc.consumed += consumed;
    acc.received += received;
    acc.movements += 1;
    acc.cost += cost;
    productAcc.set(entry.productId, acc);

    const category =
      categoryAcc.get(product.category) ??
      { consumed: 0, cost: 0, products: new Set<string>(), movements: 0 };
    category.consumed += consumed;
    category.cost += cost;
    category.products.add(entry.productId);
    category.movements += 1;
    categoryAcc.set(product.category, category);

    const branch =
      branchAcc.get(entry.branchId) ??
      {
        id: entry.branchId,
        name: entry.branch.name,
        consumed: 0,
        cost: 0,
        movements: 0,
      };
    branch.consumed += consumed;
    branch.cost += cost;
    branch.movements += 1;
    branchAcc.set(entry.branchId, branch);

    const typeLabel = ENTRY_TYPE_LABELS[entry.type] ?? entry.type;
    const type = typeAcc.get(typeLabel) ?? { movements: 0, units: 0 };
    type.movements += 1;
    type.units += Math.abs(quantity);
    typeAcc.set(typeLabel, type);

    const dayKey = entry.entryDate.toISOString().slice(0, 10);
    const day = dailyAcc.get(dayKey) ?? { consumed: 0, received: 0 };
    day.consumed += consumed;
    day.received += received;
    dailyAcc.set(dayKey, day);
  }

  /** Días de cobertura: cuánto dura el stock actual al ritmo de consumo del periodo. */
  function coverageOf(stock: number, consumed: number) {
    if (consumed <= 0) return null;
    const dailyRate = consumed / days;
    if (dailyRate <= 0) return null;
    return stock / dailyRate;
  }

  const topProducts = Array.from(productAcc.entries())
    .map(([id, acc]) => {
      const product = productById.get(id)!;
      const stock = totalStockByProduct(stockMatrix, id);

      return {
        id,
        name: product.name,
        code: product.code,
        category: product.category,
        unit: product.unit,
        consumed: acc.consumed,
        received: acc.received,
        movements: acc.movements,
        cost: acc.cost,
        stock,
        minimumStock: Number(product.minimumStock),
        daysOfCover: coverageOf(stock, acc.consumed),
      };
    })
    .sort((a, b) => b.consumed - a.consumed);

  const lowStock = products
    .filter((p) => p.isActive)
    .map((p) => {
      const stock = totalStockByProduct(stockMatrix, p.id);
      const consumed = productAcc.get(p.id)?.consumed ?? 0;

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stock,
        minimumStock: Number(p.minimumStock),
        consumed,
        daysOfCover: coverageOf(stock, consumed),
      };
    })
    .filter((p) => p.minimumStock > 0 && p.stock <= p.minimumStock)
    .sort((a, b) => a.stock - b.stock);

  const stale = products
    .filter((p) => {
      if (!p.isActive) return false;

      const last = lastMovementByProduct.get(p.id) ?? null;
      const hasStock = totalStockByProduct(stockMatrix, p.id) > 0;

      return hasStock && (!last || last < staleSince);
    })
    .map((p) => {
      const last = lastMovementByProduct.get(p.id) ?? null;

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stock: totalStockByProduct(stockMatrix, p.id),
        lastMovement: last ? last.toISOString() : null,
      };
    })
    .sort((a, b) => b.stock - a.stock);

  const outOfStockCount = products.filter(
    (p) => p.isActive && totalStockByProduct(stockMatrix, p.id) <= 0,
  ).length;

  const daily = Array.from(dailyAcc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
      }),
      consumed: Math.round(value.consumed * 10) / 10,
      received: Math.round(value.received * 10) / 10,
    }));

  return {
    days,
    totals: {
      products: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      movements: entries.length,
      consumedUnits: totalConsumed,
      receivedUnits: totalReceived,
      consumedCost: totalConsumedCost,
      lowStockCount: lowStock.length,
      outOfStockCount,
      staleCount: stale.length,
    },
    topProducts,
    categories: Array.from(categoryAcc.entries())
      .map(([name, value]) => ({
        name,
        consumed: value.consumed,
        cost: value.cost,
        products: value.products.size,
        movements: value.movements,
      }))
      .sort((a, b) => b.cost - a.cost),
    branches: Array.from(branchAcc.values()).sort((a, b) => b.cost - a.cost),
    movementTypes: Array.from(typeAcc.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.movements - a.movements),
    daily,
    lowStock,
    stale,
  };
}
