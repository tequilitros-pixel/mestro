import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SalesDashboardClient from "@/components/pos/SalesDashboardClient";

export default async function PosSalesPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sales = await prisma.posSale.findMany({
    where: {
      branchId: allowedBranchIds ? { in: allowedBranchIds } : undefined,
      createdAt: { gte: startOfToday },
    },
    include: {
      branch: { select: { id: true, name: true } },
      soldBy: { select: { id: true, name: true } },
      items: true,
      payments: true,
      cashCut: { select: { id: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <SalesDashboardClient
      branches={branches}
      initialSales={sales.map((s) => ({
        id: s.id,
        code: s.code,
        status: s.status,
        subtotal: s.subtotal,
        discountAmount: s.discountAmount,
        total: s.total,
        createdAt: s.createdAt.toISOString(),
        branch: s.branch,
        soldBy: s.soldBy,
        cashCut: s.cashCut,
        items: s.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
      }))}
      canCancel={
        user?.role === "ADMIN" || user?.role === "GERENTE" || user?.role === "ENCARGADO"
      }
    />
  );
}
