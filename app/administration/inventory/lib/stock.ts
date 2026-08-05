import { prisma } from "@/lib/prisma";

export type StockMatrix = {
  branches: { id: string; name: string }[];
  // branchId -> productId -> estimated current stock
  stockByBranch: Map<string, Map<string, number>>;
};

/**
 * Estimates current stock per branch/product from the last closed weekly
 * count plus any entries (compras, traspasos, ajustes) since that count.
 * Mirrors the calculation in branch-counts/actions.ts (closeInventoryCountAction)
 * so the "current stock" shown across the module stays consistent with what
 * a closed count would report.
 */
export async function computeStockMatrix(productIds: string[]): Promise<StockMatrix> {
  const branches = await prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const stockByBranch = new Map<string, Map<string, number>>();

  await Promise.all(
    branches.map(async (branch) => {
      const lastCount = await prisma.inventoryCount.findFirst({
        where: { branchId: branch.id, status: "CERRADO" },
        orderBy: { countDate: "desc" },
        include: { items: true },
      });

      const periodStart = lastCount?.countDate ?? new Date(0);

      const baseline = new Map<string, number>();
      for (const item of lastCount?.items ?? []) {
        baseline.set(item.productId, Number(item.quantityCounted));
      }

      const entries = await prisma.inventoryEntry.groupBy({
        by: ["productId"],
        where: { branchId: branch.id, entryDate: { gt: periodStart } },
        _sum: { quantity: true },
      });

      const entriesByProduct = new Map<string, number>();
      for (const entry of entries) {
        entriesByProduct.set(entry.productId, Number(entry._sum.quantity ?? 0));
      }

      const productMap = new Map<string, number>();
      for (const productId of productIds) {
        productMap.set(
          productId,
          (baseline.get(productId) ?? 0) + (entriesByProduct.get(productId) ?? 0),
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
