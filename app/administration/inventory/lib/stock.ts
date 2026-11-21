import { prisma } from "@/lib/prisma";

export type StockMatrix = {
  branches: { id: string; name: string }[];
  // branchId -> productId -> current quantity in the product's V2 base unit.
  stockByBranch: Map<string, Map<string, number>>;
  // A missing V2 balance is unknown, not a confirmed physical zero.
  uninitializedByBranch: Map<string, Set<string>>;
};

/** The operational stock view reads only InventoryBalance, the POS ledger. */
export async function computeStockMatrix(productIds: string[], allowedBranchIds: string[] | null = null): Promise<StockMatrix> {
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const balances = productIds.length && branches.length
    ? await prisma.inventoryBalance.findMany({
        where: { branchId: { in: branches.map((branch) => branch.id) }, inventoryProductId: { in: productIds } },
        select: { branchId: true, inventoryProductId: true, quantity: true },
      })
    : [];
  const stockByBranch = new Map<string, Map<string, number>>();
  const uninitializedByBranch = new Map<string, Set<string>>();
  for (const branch of branches) {
    stockByBranch.set(branch.id, new Map());
    uninitializedByBranch.set(branch.id, new Set(productIds));
  }
  for (const balance of balances) {
    stockByBranch.get(balance.branchId)?.set(balance.inventoryProductId, Number(balance.quantity));
    uninitializedByBranch.get(balance.branchId)?.delete(balance.inventoryProductId);
  }
  return { branches, stockByBranch, uninitializedByBranch };
}

export function totalStockByProduct(matrix: StockMatrix, productId: string): number {
  let total = 0;
  for (const productMap of matrix.stockByBranch.values()) total += productMap.get(productId) ?? 0;
  return total;
}
