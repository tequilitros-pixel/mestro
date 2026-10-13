import "server-only";

import { prisma } from "@/lib/prisma";
import type { InventoryAnalyticsRange } from "./analytics";
import { addBusinessDays, businessDayStart } from "@/lib/dateTime";

export type InventorySalesBranch = {
  id: string;
  name: string;
  sales: number;
  transactions: number;
};

export type InventorySalesAnalytics = {
  totalSales: number;
  transactions: number;
  byBranch: InventorySalesBranch[];
};

/**
 * Ventas cobradas del mismo periodo que la analítica de inventario.
 * POS legado y POS2 se muestran juntos; las devoluciones/reembolsos de POS2
 * se descuentan para que la comparación sea contra venta neta del periodo.
 */
export async function getInventorySalesAnalytics(
  range: InventoryAnalyticsRange,
  allowedBranchIds: string[] | null = null,
): Promise<InventorySalesAnalytics> {
  const since = businessDayStart(range.from);
  const until = businessDayStart(addBusinessDays(range.to, 1));
  const branchFilter = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  const [legacySales, pos2Sales] = await Promise.all([
    prisma.posSale.findMany({
      where: {
        ...branchFilter,
        createdAt: { gte: since, lt: until },
        status: "COMPLETADA",
      },
      select: {
        branchId: true,
        branch: { select: { name: true } },
        total: true,
      },
    }),
    prisma.pos2Sale.findMany({
      where: {
        ...branchFilter,
        completedAt: { gte: since, lt: until },
        status: { in: ["COMPLETED", "PARTIALLY_RETURNED", "RETURNED"] },
      },
      select: {
        branchId: true,
        branch: { select: { name: true } },
        total: true,
        refunds: { select: { amount: true } },
      },
    }),
  ]);

  const byBranch = new Map<string, InventorySalesBranch>();
  const add = (branchId: string, branchName: string, amount: number) => {
    const current = byBranch.get(branchId) ?? { id: branchId, name: branchName, sales: 0, transactions: 0 };
    current.sales += Math.max(0, amount);
    current.transactions += 1;
    byBranch.set(branchId, current);
  };

  for (const sale of legacySales) add(sale.branchId, sale.branch?.name ?? "Sucursal no disponible", Number(sale.total));
  for (const sale of pos2Sales) {
    const refunded = sale.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
    add(sale.branchId, sale.branch?.name ?? "Sucursal no disponible", Number(sale.total) - refunded);
  }

  const branches = Array.from(byBranch.values())
    .map((branch) => ({ ...branch, sales: Math.round(branch.sales * 100) / 100 }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));

  return {
    totalSales: Math.round(branches.reduce((sum, branch) => sum + branch.sales, 0) * 100) / 100,
    transactions: branches.reduce((sum, branch) => sum + branch.transactions, 0),
    byBranch: branches,
  };
}
