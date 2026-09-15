import "server-only";

import { prisma } from "@/lib/prisma";
import {
  formatCommercialQuantity,
  formatCommercialPresentation,
  hasValidCommercialConversion,
} from "@/lib/inventory/units";
import { computeStockMatrix } from "./stock";
import { getInventoryAnalytics, type InventoryAnalytics } from "./analytics";
import { inventoryCountTypeLabel } from "@/lib/inventory/countScope";

type DashboardProduct = {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  minimumStock: number;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: number | null;
  contentUnit: string | null;
  normalizedContentPerUnit: number | null;
};

export type InventoryDashboardData = {
  analytics: InventoryAnalytics;
  branches: Array<{ id: string; name: string }>;
  pendingCounts: Array<{ id: string; code: string; branchName: string; countDate: string; countType: "WEEKLY" | "MONTHLY" }>;
  counts: Array<{
    id: string;
    code: string;
    branchName: string;
    countDate: string;
    countType: "WEEKLY" | "MONTHLY";
    countTypeLabel: string;
    status: "BORRADOR" | "CERRADO";
    closedAt: string | null;
  }>;
  negativeLegacy: Array<{
    branchId: string;
    branchName: string;
    productId: string;
    productName: string;
    currentStock: number;
    displayQuantity: string;
  }>;
  incompletePresentations: Array<{
    id: string;
    name: string;
    baseUnit: string;
    display: string;
  }>;
  recentDifferences: Array<{
    id: string;
    countId: string | null;
    countCode: string | null;
    branchName: string;
    productName: string;
    expected: string;
    declared: string;
    difference: string;
    unit: string;
    createdAt: string;
  }>;
};

function toProduct(row: {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  minimumStock: unknown;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: unknown;
  contentUnit: string | null;
  normalizedContentPerUnit: unknown;
}): DashboardProduct {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category,
    unit: row.unit,
    minimumStock: Number(row.minimumStock),
    inventoryBaseUnit: row.inventoryBaseUnit,
    handlingUnit: row.handlingUnit,
    contentPerUnit: row.contentPerUnit === null ? null : Number(row.contentPerUnit),
    contentUnit: row.contentUnit,
    normalizedContentPerUnit: row.normalizedContentPerUnit === null ? null : Number(row.normalizedContentPerUnit),
  };
}

export async function getInventoryDashboardData(
  allowedBranchIds: string[] | null,
): Promise<InventoryDashboardData> {
  const branchWhere = {
    active: true,
    ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }),
  };

  const [analytics, branches, productsRows, counts, balances, declarations] = await Promise.all([
    getInventoryAnalytics(30, allowedBranchIds),
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true, archivedAt: null, trackStock: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        unit: true,
        minimumStock: true,
        inventoryBaseUnit: true,
        handlingUnit: true,
        contentPerUnit: true,
        contentUnit: true,
        normalizedContentPerUnit: true,
      },
    }),
    prisma.inventoryCount.findMany({
      where: { ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }) },
      orderBy: { countDate: "desc" },
      take: 20,
      select: {
        id: true,
        code: true,
        countDate: true,
        status: true,
        countType: true,
        closedAt: true,
        branch: { select: { name: true } },
      },
    }),
    prisma.inventoryBalance.findMany({
      where: { ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }) },
      select: { branchId: true, inventoryProductId: true },
    }),
    prisma.inventoryCountDeclaration.findMany({
      where: {
        ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
        countId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        branch: { select: { name: true } },
        inventoryProduct: {
          select: {
            name: true,
            unit: true,
            inventoryBaseUnit: true,
            handlingUnit: true,
            contentPerUnit: true,
            contentUnit: true,
            normalizedContentPerUnit: true,
          },
        },
        count: { select: { code: true } },
      },
    }),
  ]);

  const products = productsRows.map(toProduct);
  const productById = new Map(products.map((product) => [product.id, product]));
  const matrix = await computeStockMatrix(products.map((product) => product.id), allowedBranchIds);
  const balanceKeys = new Set(balances.map((balance) => `${balance.branchId}:${balance.inventoryProductId}`));

  const negativeLegacy: InventoryDashboardData["negativeLegacy"] = [];
  for (const branch of branches) {
    const productMap = matrix.stockByBranch.get(branch.id);
    if (!productMap) continue;
    for (const product of products) {
      const stock = productMap.get(product.id) ?? 0;
      if (stock < 0 && !balanceKeys.has(`${branch.id}:${product.id}`)) {
        negativeLegacy.push({
          branchId: branch.id,
          branchName: branch.name,
          productId: product.id,
          productName: product.name,
          currentStock: stock,
          displayQuantity: formatCommercialQuantity(stock, product),
        });
      }
    }
  }

  const incompletePresentations = products
    .filter((product) => !hasValidCommercialConversion(product))
    .map((product) => ({
      id: product.id,
      name: product.name,
      baseUnit: product.inventoryBaseUnit ?? product.unit,
      display: formatCommercialPresentation(product) ?? "Presentación por configurar",
    }));

  const recentDifferences = declarations.map((declaration) => {
    const product = productById.get(declaration.inventoryProductId) ?? {
      id: declaration.inventoryProductId,
      name: declaration.inventoryProduct.name,
      code: "",
      category: "",
      unit: declaration.inventoryProduct.unit,
      minimumStock: 0,
      inventoryBaseUnit: declaration.inventoryProduct.inventoryBaseUnit,
      handlingUnit: declaration.inventoryProduct.handlingUnit,
      contentPerUnit: declaration.inventoryProduct.contentPerUnit,
      contentUnit: declaration.inventoryProduct.contentUnit,
      normalizedContentPerUnit: declaration.inventoryProduct.normalizedContentPerUnit,
    };
    const expected = Number(declaration.expectedQuantity);
    const declared = Number(declaration.declaredQuantity);
    return {
      id: declaration.id,
      countId: declaration.countId,
      countCode: declaration.count?.code ?? null,
      branchName: declaration.branch.name,
      productName: product.name,
      expected: formatCommercialQuantity(expected, product),
      declared: formatCommercialQuantity(declared, product),
      difference: formatCommercialQuantity(declared - expected, product),
      unit: declaration.unit,
      createdAt: declaration.createdAt.toISOString(),
    };
  });

  return {
    analytics,
    branches,
    pendingCounts: counts
      .filter((count) => count.status === "BORRADOR")
      .map((count) => ({ id: count.id, code: count.code, branchName: count.branch.name, countDate: count.countDate.toISOString(), countType: count.countType })),
    counts: counts.map((count) => ({
      id: count.id,
      code: count.code,
      branchName: count.branch.name,
      countDate: count.countDate.toISOString(),
      countType: count.countType,
      countTypeLabel: inventoryCountTypeLabel(count.countType),
      status: count.status,
      closedAt: count.closedAt?.toISOString() ?? null,
    })),
    negativeLegacy,
    incompletePresentations,
    recentDifferences,
  };
}
