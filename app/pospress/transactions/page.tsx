import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TransactionCenter from "@/components/pospress/TransactionCenter";
import { addDaysToDateOnly, businessDayStart, todayDateOnly } from "@/lib/dateOnly";
import { withRlsContext } from "@/lib/rls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressTransactionsPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();
  if (!user) return null;

  const branches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const today = todayDateOnly();
  const sales = await withRlsContext(user, (tx) => tx.posSale.findMany({
    where: {
      ...(allowedBranchIds ? { branchId: { in: allowedBranchIds } } : {}),
      createdAt: { gte: businessDayStart(today), lt: businessDayStart(addDaysToDateOnly(today, 1)) },
    },
    include: {
      branch: { select: { id: true, name: true } },
      soldBy: { select: { id: true, name: true } },
      cashCut: { select: { id: true, code: true } },
      items: { select: { id: true, name: true, quantity: true, lineTotal: true } },
      payments: { select: { method: true, amount: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  }));

  return (
    <TransactionCenter
      branches={branches}
      initialSales={sales.map((sale) => ({
        id: sale.id,
        code: sale.code,
        status: sale.status,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        total: sale.total,
        createdAt: sale.createdAt.toISOString(),
        branch: sale.branch,
        soldBy: sale.soldBy,
        cashCut: sale.cashCut,
        items: sale.items,
        payments: sale.payments,
        cancelReason: sale.cancelReason,
      }))}
      canCancel={user.role === "ADMIN" || user.role === "GERENTE" || user.role === "ENCARGADO"}
    />
  );
}
