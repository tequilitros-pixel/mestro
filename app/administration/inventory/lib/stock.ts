import { prisma } from "@/lib/prisma";

export type StockMatrix = {
  branches: { id: string; name: string }[];
  // branchId -> productId -> estimated current stock
  stockByBranch: Map<string, Map<string, number>>;
};

/**
 * Estimates current stock per branch/product from the latest closed count
 * containing that product plus any entries since that product's count.
 * A weekly count intentionally omits monthly-only products, so the baseline
 * must be selected per product rather than once per branch.
 * Mirrors the calculation in branch-counts/actions.ts (closeInventoryCountAction)
 * so the "current stock" shown across the module stays consistent with what
 * a closed count would report.
 */
export async function computeStockMatrix(productIds: string[], allowedBranchIds: string[] | null = null): Promise<StockMatrix> {
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const stockByBranch = new Map<string, Map<string, number>>();

  await Promise.all(
    branches.map(async (branch) => {
      const v2Balances = await prisma.inventoryBalance.findMany({
        where: { branchId: branch.id, inventoryProductId: { in: productIds } },
        select: { inventoryProductId: true, quantity: true },
      });
      const v2ByProduct = new Map(v2Balances.map((balance) => [balance.inventoryProductId, Number(balance.quantity)]));
      const baseline = new Map<string, number>();
      const periodStartByProduct = new Map<string, Date>();
      const legacyProductIds = productIds.filter((productId) => !v2ByProduct.has(productId));
      const closedCounts = legacyProductIds.length === 0
        ? []
        : await prisma.inventoryCount.findMany({
            where: {
              branchId: branch.id,
              status: "CERRADO",
              items: { some: { productId: { in: legacyProductIds } } },
            },
            orderBy: [{ countDate: "desc" }, { id: "desc" }],
            select: {
              countDate: true,
              items: {
                where: { productId: { in: legacyProductIds } },
                select: { productId: true, quantityCounted: true },
              },
            },
          });

      for (const count of closedCounts) {
        for (const item of count.items) {
          if (baseline.has(item.productId)) continue;
          baseline.set(item.productId, item.quantityCounted === null ? 0 : Number(item.quantityCounted));
          periodStartByProduct.set(item.productId, count.countDate);
        }
      }

      const periodStarts = [...periodStartByProduct.values()];
      const earliestPeriodStart = periodStarts.length > 0
        ? periodStarts.reduce((earliest, value) => (value < earliest ? value : earliest))
        : new Date(0);
      const entries = legacyProductIds.length === 0
        ? []
        : await prisma.inventoryEntry.findMany({
            where: {
              branchId: branch.id,
              productId: { in: legacyProductIds },
              entryDate: { gt: earliestPeriodStart },
            },
            select: { productId: true, entryDate: true, quantity: true },
          });

      const entriesByProduct = new Map<string, number>();
      for (const entry of entries) {
        const periodStart = periodStartByProduct.get(entry.productId) ?? new Date(0);
        if (entry.entryDate <= periodStart) continue;
        entriesByProduct.set(
          entry.productId,
          (entriesByProduct.get(entry.productId) ?? 0) + Number(entry.quantity),
        );
      }

      const productMap = new Map<string, number>();
      for (const productId of productIds) {
        productMap.set(
          productId,
          v2ByProduct.has(productId)
            ? v2ByProduct.get(productId)!
            : (baseline.get(productId) ?? 0) + (entriesByProduct.get(productId) ?? 0),
        );
      }
      stockByBranch.set(branch.id, productMap);
    }),
  );

  return { branches, stockByBranch };
}

export function totalStockByProduct(matrix: StockMatrix, productId: string): number {
  let total = 0;
  for (const productMap of matrix.stockByBranch.values()) {
    total += productMap.get(productId) ?? 0;
  }
  return total;
}
