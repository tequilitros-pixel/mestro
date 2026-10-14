import { addDaysToDateOnly, businessDayStart } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { summarizeBranchSales, type BranchSalesOverview } from "./branchSalesSummary";

export type { BranchSalesOverview } from "./branchSalesSummary";

export async function getBranchSalesOverview(input: {
  branchId: string;
  from: string;
  to: string;
}): Promise<BranchSalesOverview> {
  const sales = await prisma.posSale.findMany({
    where: {
      branchId: input.branchId,
      status: "COMPLETADA",
      createdAt: {
        gte: businessDayStart(input.from),
        lt: businessDayStart(addDaysToDateOnly(input.to, 1)),
      },
    },
    select: {
      total: true,
      createdAt: true,
      payments: { select: { method: true, amount: true } },
      items: {
        select: {
          name: true,
          quantity: true,
          lineTotal: true,
          isCustom: true,
          variant: { select: { product: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return summarizeBranchSales(sales);
}
