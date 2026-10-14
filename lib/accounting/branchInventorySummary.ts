export type InventoryConsumptionRow = {
  productId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  direction: "consumption" | "reversal";
};

export type InventoryTheoreticalRow = Omit<InventoryConsumptionRow, "direction">;

export type BranchInventoryOverview = {
  actual: {
    products: number;
    movements: number;
    cost: number;
    costKnown: boolean;
  };
  theoretical: {
    products: number;
    sales: number;
    cost: number;
    costKnown: boolean;
  };
  products: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    actualQuantity: number;
    theoreticalQuantity: number;
    actualCost: number;
    theoreticalCost: number;
    actualCostKnown: boolean;
    theoreticalCostKnown: boolean;
  }>;
};

type ProductTotal = BranchInventoryOverview["products"][number];

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyProduct(row: Omit<InventoryConsumptionRow, "quantity" | "unitCost" | "direction">): ProductTotal {
  return {
    id: row.productId,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    actualQuantity: 0,
    theoreticalQuantity: 0,
    actualCost: 0,
    theoreticalCost: 0,
    actualCostKnown: true,
    theoreticalCostKnown: true,
  };
}

/**
 * Compara el consumo que registró el libro de inventario contra el consumo
 * teórico de las recetas vendidas. No modifica saldos ni movimientos.
 */
export function summarizeBranchInventory(input: {
  actualRows: InventoryConsumptionRow[];
  theoreticalRows: InventoryTheoreticalRow[];
  saleCount: number;
}): BranchInventoryOverview {
  const products = new Map<string, ProductTotal>();
  const total = () => [...products.values()];

  for (const row of input.actualRows) {
    const current = products.get(row.productId) ?? emptyProduct(row);
    const quantity = Math.abs(row.quantity);
    const signedQuantity = row.direction === "reversal" ? -quantity : quantity;
    current.actualQuantity += signedQuantity;
    if (row.unitCost === null && quantity > 0) current.actualCostKnown = false;
    else current.actualCost += signedQuantity * (row.unitCost ?? 0);
    products.set(row.productId, current);
  }

  for (const row of input.theoreticalRows) {
    const current = products.get(row.productId) ?? emptyProduct(row);
    const quantity = Math.max(0, row.quantity);
    current.theoreticalQuantity += quantity;
    if (row.unitCost === null && quantity > 0) current.theoreticalCostKnown = false;
    else current.theoreticalCost += quantity * (row.unitCost ?? 0);
    products.set(row.productId, current);
  }

  const rows = total()
    .map((row) => ({
      ...row,
      actualQuantity: roundQuantity(Math.max(0, row.actualQuantity)),
      theoreticalQuantity: roundQuantity(row.theoreticalQuantity),
      actualCost: roundMoney(Math.max(0, row.actualCost)),
      theoreticalCost: roundMoney(row.theoreticalCost),
    }))
    .filter((row) => row.actualQuantity > 0 || row.theoreticalQuantity > 0)
    .sort((a, b) => b.theoreticalCost - a.theoreticalCost || b.actualCost - a.actualCost || a.name.localeCompare(b.name, "es"));

  return {
    actual: {
      products: rows.filter((row) => row.actualQuantity > 0).length,
      movements: input.actualRows.length,
      cost: roundMoney(rows.reduce((sum, row) => sum + row.actualCost, 0)),
      costKnown: rows.filter((row) => row.actualQuantity > 0).every((row) => row.actualCostKnown),
    },
    theoretical: {
      products: rows.filter((row) => row.theoreticalQuantity > 0).length,
      sales: input.saleCount,
      cost: roundMoney(rows.reduce((sum, row) => sum + row.theoreticalCost, 0)),
      costKnown: rows.filter((row) => row.theoreticalQuantity > 0).every((row) => row.theoreticalCostKnown),
    },
    products: rows,
  };
}
