import { prisma } from "@/lib/prisma";
import { computeStockMatrix, totalStockByProduct } from "./stock";
import {
  addBusinessDays,
  businessDayStart,
  formatBusinessDateOnly,
  formatCivilDate,
} from "@/lib/dateTime";

/**
 * Analítica del inventario para el tablero de inicio.
 *
 * La vista combina los dos libros que existen en producción. Cuando una
 * sucursal/producto ya tiene saldo V2, se usa InventoryMovement para no
 * duplicar los InventoryEntry espejo. Los productos que todavía viven en el
 * libro histórico se leen desde InventoryEntry.
 */

const ANALYTICS_DAYS = 30;
const STALE_DAYS = 60;

const ENTRY_TYPE_LABELS: Record<string, string> = {
  COMPRA: "Compras",
  TRASPASO: "Traspasos",
  AJUSTE: "Ajustes",
  VENTA_POS: "Ventas POS",
  DEVOLUCION_POS: "Devoluciones POS",
  SALIDA_EVENTO: "Salidas a eventos",
  REGRESO_EVENTO: "Regresos de eventos",
  PRODUCCION: "Producción",
  OPENING_BALANCE: "Saldos iniciales",
  RECEIPT: "Recepciones",
  SALE_CONSUMPTION: "Consumo POS",
  SALE_REVERSAL: "Reversiones POS",
  TRANSFER_OUT: "Traspasos enviados",
  TRANSFER_IN: "Traspasos recibidos",
  ADJUSTMENT_IN: "Ajustes positivos",
  ADJUSTMENT_OUT: "Mermas y ajustes negativos",
  COUNT_CORRECTION: "Correcciones de conteo",
  EVENT_LOAD: "Carga de eventos",
  EVENT_RETURN: "Regreso de eventos",
};

type ProductAccumulator = {
  consumedOut: number;
  consumedReversal: number;
  consumedCostOut: number;
  consumedCostReversal: number;
  received: number;
  receivedCost: number;
  waste: number;
  wasteCost: number;
  movements: number;
  mismatches: number;
  mismatchUnits: number;
};

type BranchAccumulator = {
  id: string;
  name: string;
  consumedOut: number;
  consumedReversal: number;
  consumedCostOut: number;
  consumedCostReversal: number;
  received: number;
  receivedCost: number;
  waste: number;
  wasteCost: number;
  movements: number;
  transfersIn: number;
  transfersOut: number;
  mismatches: number;
  mismatchUnits: number;
  shortageUnits: number;
  surplusUnits: number;
  currentStockValue: number;
  stockedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  negativeProductCount: number;
};

export type InventoryBranchAnalytics = {
  id: string;
  name: string;
  consumed: number;
  consumedCost: number;
  /** Compatibilidad con el tablero general de inventario. */
  cost: number;
  received: number;
  receivedCost: number;
  waste: number;
  wasteCost: number;
  movements: number;
  transfersIn: number;
  transfersOut: number;
  mismatches: number;
  mismatchUnits: number;
  shortageUnits: number;
  surplusUnits: number;
  currentStockValue: number;
  stockedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  negativeProductCount: number;
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
    wasteUnits: number;
    wasteCost: number;
    mismatchCount: number;
    mismatchUnits: number;
    shortageUnits: number;
    surplusUnits: number;
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
    waste: number;
    wasteCost: number;
    mismatches: number;
    mismatchUnits: number;
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
    waste: number;
    products: number;
    movements: number;
  }>;
  branches: InventoryBranchAnalytics[];
  movementTypes: Array<{ name: string; movements: number; units: number }>;
  daily: Array<{ date: string; label: string; consumed: number; received: number; waste: number }>;
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

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function emptyProductAccumulator(): ProductAccumulator {
  return {
    consumedOut: 0,
    consumedReversal: 0,
    consumedCostOut: 0,
    consumedCostReversal: 0,
    received: 0,
    receivedCost: 0,
    waste: 0,
    wasteCost: 0,
    movements: 0,
    mismatches: 0,
    mismatchUnits: 0,
  };
}

function emptyBranchAccumulator(id: string, name: string): BranchAccumulator {
  return {
    id,
    name,
    consumedOut: 0,
    consumedReversal: 0,
    consumedCostOut: 0,
    consumedCostReversal: 0,
    received: 0,
    receivedCost: 0,
    waste: 0,
    wasteCost: 0,
    movements: 0,
    transfersIn: 0,
    transfersOut: 0,
    mismatches: 0,
    mismatchUnits: 0,
    shortageUnits: 0,
    surplusUnits: 0,
    currentStockValue: 0,
    stockedProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeProductCount: 0,
  };
}

function netConsumed(acc: Pick<ProductAccumulator, "consumedOut" | "consumedReversal"> | Pick<BranchAccumulator, "consumedOut" | "consumedReversal">) {
  return Math.max(0, acc.consumedOut - acc.consumedReversal);
}

function netConsumedCost(acc: Pick<ProductAccumulator, "consumedCostOut" | "consumedCostReversal"> | Pick<BranchAccumulator, "consumedCostOut" | "consumedCostReversal">) {
  return Math.max(0, acc.consumedCostOut - acc.consumedCostReversal);
}

function addConsumed(
  acc: ProductAccumulator | BranchAccumulator,
  quantity: number,
  unitCost: number,
  reversal = false,
) {
  const amount = Math.abs(quantity);
  if (reversal) {
    acc.consumedReversal += amount;
    acc.consumedCostReversal += amount * unitCost;
  } else {
    acc.consumedOut += amount;
    acc.consumedCostOut += amount * unitCost;
  }
}

function addReceived(acc: ProductAccumulator | BranchAccumulator, quantity: number, unitCost: number) {
  const amount = Math.abs(quantity);
  acc.received += amount;
  acc.receivedCost += amount * unitCost;
}

function addWaste(acc: ProductAccumulator | BranchAccumulator, quantity: number, unitCost: number) {
  const amount = Math.abs(quantity);
  acc.waste += amount;
  acc.wasteCost += amount * unitCost;
}

export async function getInventoryAnalytics(
  days = ANALYTICS_DAYS,
  allowedBranchIds: string[] | null = null,
): Promise<InventoryAnalytics> {
  const today = formatBusinessDateOnly(new Date());
  const since = businessDayStart(addBusinessDays(today, -(days - 1)));
  const staleSince = businessDayStart(addBusinessDays(today, -STALE_DAYS));
  const branchWhere = {
    active: true,
    ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }),
  };
  const branchFilter = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  const [products, branches, entries, v2Movements, balances, declarations, branchMinimums, lastMovements, lastV2Movements] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { archivedAt: null, trackStock: true },
      select: { id: true, code: true, name: true, category: true, unit: true, unitCost: true, minimumStock: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryEntry.findMany({
      where: { entryDate: { gte: since }, ...branchFilter },
      select: { productId: true, branchId: true, type: true, quantity: true, unitCost: true, entryDate: true, branch: { select: { id: true, name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: since }, ...branchFilter },
      select: { inventoryProductId: true, branchId: true, movementType: true, quantityDelta: true, createdAt: true },
    }),
    prisma.inventoryBalance.findMany({ where: branchFilter, select: { branchId: true, inventoryProductId: true } }),
    prisma.inventoryCountDeclaration.findMany({
      where: { createdAt: { gte: since }, ...branchFilter },
      select: { branchId: true, inventoryProductId: true, expectedQuantity: true, declaredQuantity: true },
    }),
    prisma.branchInventoryMinimum.findMany({ where: branchFilter, select: { branchId: true, inventoryProductId: true, minimumQuantity: true } }),
    prisma.inventoryEntry.groupBy({
      by: ["productId"],
      where: allowedBranchIds === null ? undefined : { branchId: { in: allowedBranchIds } },
      _max: { entryDate: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ["inventoryProductId"],
      where: allowedBranchIds === null ? undefined : { branchId: { in: allowedBranchIds } },
      _max: { createdAt: true },
    }),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const balanceKeys = new Set(balances.map((balance) => `${balance.branchId}:${balance.inventoryProductId}`));
  const lastMovementByProduct = new Map<string, Date | null>();
  for (const movement of lastMovements) lastMovementByProduct.set(movement.productId, movement._max.entryDate);
  for (const movement of lastV2Movements) {
    const previous = lastMovementByProduct.get(movement.inventoryProductId) ?? null;
    const current = movement._max.createdAt;
    if (!previous || (current && current > previous)) lastMovementByProduct.set(movement.inventoryProductId, current);
  }
  const stockMatrix = await computeStockMatrix(products.map((product) => product.id), allowedBranchIds);

  const productAcc = new Map<string, ProductAccumulator>();
  const categoryAcc = new Map<string, { consumed: number; cost: number; waste: number; products: Set<string>; movements: number }>();
  const branchAcc = new Map<string, BranchAccumulator>();
  const typeAcc = new Map<string, { movements: number; units: number }>();
  const dailyAcc = new Map<string, { consumedOut: number; consumedReversal: number; received: number; waste: number }>();

  for (const branch of branches) branchAcc.set(branch.id, emptyBranchAccumulator(branch.id, branch.name));
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addBusinessDays(today, -index);
    dailyAcc.set(date, { consumedOut: 0, consumedReversal: 0, received: 0, waste: 0 });
  }

  function productAccumulator(productId: string) {
    const value = productAcc.get(productId) ?? emptyProductAccumulator();
    productAcc.set(productId, value);
    return value;
  }

  function branchAccumulator(branchId: string, branchName?: string) {
    const value = branchAcc.get(branchId) ?? emptyBranchAccumulator(branchId, branchName ?? "Sucursal");
    branchAcc.set(branchId, value);
    return value;
  }

  function recordType(type: string, units: number) {
    const label = ENTRY_TYPE_LABELS[type] ?? type;
    const value = typeAcc.get(label) ?? { movements: 0, units: 0 };
    value.movements += 1;
    value.units += units;
    typeAcc.set(label, value);
  }

  function recordLegacyEntry(entry: (typeof entries)[number]) {
    const product = productById.get(entry.productId);
    if (!product || balanceKeys.has(`${entry.branchId}:${entry.productId}`)) return;
    const quantity = Number(entry.quantity);
    const unitCost = entry.unitCost !== null ? Number(entry.unitCost) : Number(product.unitCost ?? 0);
    const amount = Math.abs(quantity);
    const productValue = productAccumulator(entry.productId);
    const branchValue = branchAccumulator(entry.branchId, entry.branch?.name);
    const day = dailyAcc.get(formatBusinessDateOnly(entry.entryDate));

    productValue.movements += 1;
    branchValue.movements += 1;
    recordType(entry.type, amount);

    if (entry.type === "VENTA_POS" || entry.type === "DEVOLUCION_POS") {
      const reversal = quantity > 0 || entry.type === "DEVOLUCION_POS";
      addConsumed(productValue, quantity, unitCost, reversal);
      addConsumed(branchValue, quantity, unitCost, reversal);
      if (day) {
        if (reversal) day.consumedReversal += amount;
        else day.consumedOut += amount;
      }
    } else if (entry.type === "SALIDA_EVENTO" || entry.type === "REGRESO_EVENTO") {
      const reversal = entry.type === "REGRESO_EVENTO" || quantity > 0;
      addConsumed(productValue, quantity, unitCost, reversal);
      addConsumed(branchValue, quantity, unitCost, reversal);
      if (day) {
        if (reversal) day.consumedReversal += amount;
        else day.consumedOut += amount;
      }
    } else if (entry.type === "AJUSTE" && quantity < 0) {
      addWaste(productValue, quantity, unitCost);
      addWaste(branchValue, quantity, unitCost);
      if (day) day.waste += amount;
    } else if (entry.type === "TRASPASO") {
      if (quantity < 0) branchValue.transfersOut += amount;
      else branchValue.transfersIn += amount;
      if (quantity > 0) {
        addReceived(productValue, quantity, unitCost);
        addReceived(branchValue, quantity, unitCost);
        if (day) day.received += amount;
      }
    } else if (quantity > 0) {
      addReceived(productValue, quantity, unitCost);
      addReceived(branchValue, quantity, unitCost);
      if (day) day.received += amount;
    }
  }

  for (const entry of entries) recordLegacyEntry(entry);

  for (const movement of v2Movements) {
    const product = productById.get(movement.inventoryProductId);
    if (!product) continue;
    const quantity = Number(movement.quantityDelta);
    const amount = Math.abs(quantity);
    const unitCost = Number(product.unitCost ?? 0);
    const productValue = productAccumulator(movement.inventoryProductId);
    const branchValue = branchAccumulator(movement.branchId, branchById.get(movement.branchId)?.name);
    const day = dailyAcc.get(formatBusinessDateOnly(movement.createdAt));

    productValue.movements += 1;
    branchValue.movements += 1;
    recordType(movement.movementType, amount);

    switch (movement.movementType) {
      case "SALE_CONSUMPTION":
        addConsumed(productValue, quantity, unitCost);
        addConsumed(branchValue, quantity, unitCost);
        if (day) day.consumedOut += amount;
        break;
      case "SALE_REVERSAL":
        addConsumed(productValue, quantity, unitCost, true);
        addConsumed(branchValue, quantity, unitCost, true);
        if (day) day.consumedReversal += amount;
        break;
      case "EVENT_LOAD":
        addConsumed(productValue, quantity, unitCost);
        addConsumed(branchValue, quantity, unitCost);
        if (day) day.consumedOut += amount;
        break;
      case "EVENT_RETURN":
        addConsumed(productValue, quantity, unitCost, true);
        addConsumed(branchValue, quantity, unitCost, true);
        if (day) day.consumedReversal += amount;
        break;
      case "ADJUSTMENT_OUT":
        addWaste(productValue, quantity, unitCost);
        addWaste(branchValue, quantity, unitCost);
        if (day) day.waste += amount;
        break;
      case "TRANSFER_OUT":
        branchValue.transfersOut += amount;
        break;
      case "TRANSFER_IN":
        branchValue.transfersIn += amount;
        addReceived(productValue, quantity, unitCost);
        addReceived(branchValue, quantity, unitCost);
        if (day) day.received += amount;
        break;
      case "RECEIPT":
      case "ADJUSTMENT_IN":
        if (quantity > 0) {
          addReceived(productValue, quantity, unitCost);
          addReceived(branchValue, quantity, unitCost);
          if (day) day.received += amount;
        }
        break;
      case "COUNT_CORRECTION":
      case "OPENING_BALANCE":
      default:
        break;
    }
  }

  for (const declaration of declarations) {
    const expected = Number(declaration.expectedQuantity);
    const declared = Number(declaration.declaredQuantity);
    const difference = expected - declared;
    if (difference === 0) continue;
    const branchValue = branchAccumulator(declaration.branchId, branchById.get(declaration.branchId)?.name);
    const productValue = productAccumulator(declaration.inventoryProductId);
    const absolute = Math.abs(difference);
    branchValue.mismatches += 1;
    branchValue.mismatchUnits += absolute;
    branchValue.shortageUnits += Math.max(0, difference);
    branchValue.surplusUnits += Math.max(0, -difference);
    productValue.mismatches += 1;
    productValue.mismatchUnits += absolute;
  }

  const minimumByBranchProduct = new Map(branchMinimums.map((minimum) => [
    `${minimum.branchId}:${minimum.inventoryProductId}`,
    Number(minimum.minimumQuantity),
  ]));
  for (const branch of branches) {
    const branchValue = branchAccumulator(branch.id, branch.name);
    const productMap = stockMatrix.stockByBranch.get(branch.id);
    if (!productMap) continue;
    for (const product of products) {
      const stock = productMap.get(product.id) ?? 0;
      branchValue.currentStockValue += stock * Number(product.unitCost ?? 0);
      if (stock > 0) branchValue.stockedProducts += 1;
      if (stock <= 0) branchValue.outOfStockCount += 1;
      if (stock < 0) branchValue.negativeProductCount += 1;
      const minimum = minimumByBranchProduct.get(`${branch.id}:${product.id}`) ?? Number(product.minimumStock);
      if (minimum > 0 && stock <= minimum) branchValue.lowStockCount += 1;
    }
  }

  for (const [productId, acc] of productAcc) {
    const product = productById.get(productId);
    if (!product) continue;
    const category = categoryAcc.get(product.category) ?? {
      consumed: 0,
      cost: 0,
      waste: 0,
      products: new Set<string>(),
      movements: 0,
    };
    category.consumed += netConsumed(acc);
    category.cost += netConsumedCost(acc);
    category.waste += acc.waste;
    category.products.add(productId);
    category.movements += acc.movements;
    categoryAcc.set(product.category, category);
  }

  const coverageOf = (stock: number, consumed: number) => consumed > 0 ? stock / (consumed / days) : null;

  const topProducts = Array.from(productAcc.entries())
    .flatMap(([id, acc]) => {
      const product = productById.get(id);
      if (!product) return [];
      const consumed = netConsumed(acc);
      const stock = totalStockByProduct(stockMatrix, id);
      return [{
        id,
        name: product.name,
        code: product.code,
        category: product.category,
        unit: product.unit,
        consumed,
        received: acc.received,
        waste: acc.waste,
        wasteCost: acc.wasteCost,
        mismatches: acc.mismatches,
        mismatchUnits: acc.mismatchUnits,
        movements: acc.movements,
        cost: netConsumedCost(acc),
        stock,
        minimumStock: Number(product.minimumStock),
        daysOfCover: coverageOf(stock, consumed),
      }];
    })
    .sort((a, b) => b.consumed - a.consumed);

  const lowStock = products
    .filter((product) => product.isActive)
    .map((product) => {
      const stock = totalStockByProduct(stockMatrix, product.id);
      const consumed = productAcc.has(product.id) ? netConsumed(productAcc.get(product.id)!) : 0;
      return { id: product.id, name: product.name, category: product.category, unit: product.unit, stock, minimumStock: Number(product.minimumStock), consumed, daysOfCover: coverageOf(stock, consumed) };
    })
    .filter((product) => product.minimumStock > 0 && product.stock <= product.minimumStock)
    .sort((a, b) => a.stock - b.stock);

  const stale = products
    .filter((product) => {
      if (!product.isActive) return false;
      const last = lastMovementByProduct.get(product.id) ?? null;
      return totalStockByProduct(stockMatrix, product.id) > 0 && (!last || last < staleSince);
    })
    .map((product) => {
      const last = lastMovementByProduct.get(product.id) ?? null;
      return { id: product.id, name: product.name, category: product.category, unit: product.unit, stock: totalStockByProduct(stockMatrix, product.id), lastMovement: last ? last.toISOString() : null };
    })
    .sort((a, b) => b.stock - a.stock);

  const branchesResult = Array.from(branchAcc.values())
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      consumed: netConsumed(branch),
      consumedCost: netConsumedCost(branch),
      cost: netConsumedCost(branch),
      received: branch.received,
      receivedCost: branch.receivedCost,
      waste: branch.waste,
      wasteCost: branch.wasteCost,
      movements: branch.movements,
      transfersIn: branch.transfersIn,
      transfersOut: branch.transfersOut,
      mismatches: branch.mismatches,
      mismatchUnits: branch.mismatchUnits,
      shortageUnits: branch.shortageUnits,
      surplusUnits: branch.surplusUnits,
      currentStockValue: branch.currentStockValue,
      stockedProducts: branch.stockedProducts,
      lowStockCount: branch.lowStockCount,
      outOfStockCount: branch.outOfStockCount,
      negativeProductCount: branch.negativeProductCount,
    }))
    .sort((a, b) => b.consumed - a.consumed || a.name.localeCompare(b.name));

  const daily = Array.from(dailyAcc.entries()).map(([date, value]) => ({
    date,
    label: formatCivilDate(`${date}T00:00:00.000Z`, { day: "2-digit", month: "short" }),
    consumed: round(Math.max(0, value.consumedOut - value.consumedReversal)),
    received: round(value.received),
    waste: round(value.waste),
  }));

  return {
    days,
    totals: {
      products: products.length,
      activeProducts: products.filter((product) => product.isActive).length,
      movements: branchesResult.reduce((sum, branch) => sum + branch.movements, 0),
      consumedUnits: branchesResult.reduce((sum, branch) => sum + branch.consumed, 0),
      receivedUnits: branchesResult.reduce((sum, branch) => sum + branch.received, 0),
      consumedCost: branchesResult.reduce((sum, branch) => sum + branch.consumedCost, 0),
      wasteUnits: branchesResult.reduce((sum, branch) => sum + branch.waste, 0),
      wasteCost: branchesResult.reduce((sum, branch) => sum + branch.wasteCost, 0),
      mismatchCount: branchesResult.reduce((sum, branch) => sum + branch.mismatches, 0),
      mismatchUnits: branchesResult.reduce((sum, branch) => sum + branch.mismatchUnits, 0),
      shortageUnits: branchesResult.reduce((sum, branch) => sum + branch.shortageUnits, 0),
      surplusUnits: branchesResult.reduce((sum, branch) => sum + branch.surplusUnits, 0),
      lowStockCount: lowStock.length,
      outOfStockCount: products.filter((product) => product.isActive && totalStockByProduct(stockMatrix, product.id) <= 0).length,
      staleCount: stale.length,
    },
    topProducts,
    categories: Array.from(categoryAcc.entries()).map(([name, value]) => ({
      name,
      consumed: value.consumed,
      cost: value.cost,
      waste: value.waste,
      products: value.products.size,
      movements: value.movements,
    })).sort((a, b) => b.consumed - a.consumed),
    branches: branchesResult,
    movementTypes: Array.from(typeAcc.entries()).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.movements - a.movements),
    daily,
    lowStock,
    stale,
  };
}
