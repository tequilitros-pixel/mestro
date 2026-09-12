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
export async function computeStockMatrix(productIds: string[], allowedBranchIds: string[] | null = null): Promise<StockMatrix> {
  const traceStart = Date.now();
  const branchesQueryStart = Date.now();
  console.info(`[INVENTORY_TRACE] stock.branches start mode=single`);
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  console.info(
    `[INVENTORY_TRACE] stock.branches end duration=${Date.now() - branchesQueryStart}ms results=${branches.length}`,
  );

  const stockByBranch = new Map<string, Map<string, number>>();

  await Promise.all(
    branches.map(async (branch) => {
      const branchStart = Date.now();
      console.info(`[INVENTORY_TRACE] stock.branch start mode=parallel`);
      const balanceStart = Date.now();
      console.info(`[INVENTORY_TRACE] stock.balance start mode=sequential`);
      const v2Balances = await prisma.inventoryBalance.findMany({
        where: { branchId: branch.id, inventoryProductId: { in: productIds } },
        select: { inventoryProductId: true, quantity: true },
      });
      console.info(
        `[INVENTORY_TRACE] stock.balance end duration=${Date.now() - balanceStart}ms results=${v2Balances.length}`,
      );
      const v2ByProduct = new Map(v2Balances.map((balance) => [balance.inventoryProductId, Number(balance.quantity)]));
      const countStart = Date.now();
      console.info(`[INVENTORY_TRACE] stock.lastCount start mode=sequential`);
      const lastCount = await prisma.inventoryCount.findFirst({
        where: { branchId: branch.id, status: "CERRADO" },
        orderBy: { countDate: "desc" },
        include: { items: true },
      });
      console.info(
        `[INVENTORY_TRACE] stock.lastCount end duration=${Date.now() - countStart}ms results=${lastCount ? 1 : 0}`,
      );

      const periodStart = lastCount?.countDate ?? new Date(0);

      const baseline = new Map<string, number>();
      for (const item of lastCount?.items ?? []) {
        baseline.set(item.productId, Number(item.quantityCounted));
      }

      const entriesStart = Date.now();
      console.info(`[INVENTORY_TRACE] stock.entries start mode=sequential`);
      const entries = await prisma.inventoryEntry.groupBy({
        by: ["productId"],
        where: { branchId: branch.id, entryDate: { gt: periodStart } },
        _sum: { quantity: true },
      });
      console.info(
        `[INVENTORY_TRACE] stock.entries end duration=${Date.now() - entriesStart}ms results=${entries.length}`,
      );

      const entriesByProduct = new Map<string, number>();
      for (const entry of entries) {
        entriesByProduct.set(entry.productId, Number(entry._sum.quantity ?? 0));
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
      console.info(`[INVENTORY_TRACE] stock.branch end duration=${Date.now() - branchStart}ms`);
    }),
  );

  console.info(`[INVENTORY_TRACE] stock function end duration=${Date.now() - traceStart}ms`);
  return { branches, stockByBranch };
}

export function totalStockByProduct(matrix: StockMatrix, productId: string): number {
  let total = 0;
  for (const productMap of matrix.stockByBranch.values()) {
    total += productMap.get(productId) ?? 0;
  }
  return total;
}
