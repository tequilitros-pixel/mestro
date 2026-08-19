import { prisma } from "@/lib/prisma";
import { parseDateOnly, todayDateOnly } from "@/lib/dateOnly";

export async function getActiveDiscountRules(branchId: string) {
  const today = parseDateOnly(todayDateOnly());
  return prisma.posDiscountRule.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: today } }] },
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        { OR: [{ branches: { none: {} } }, { branches: { some: { id: branchId } } }] },
      ],
    },
    orderBy: [{ mode: "asc" }, { name: "asc" }],
  });
}
