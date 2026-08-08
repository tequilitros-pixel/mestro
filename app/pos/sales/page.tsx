import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SalesDashboardClient from "@/components/pos/SalesDashboardClient";

/**
 * Ventana de análisis por defecto. La lista con buscador (pestaña
 * "Buscar") sigue refrescándose por día contra /api/pos/sales, pero
 * las pestañas visuales (sucursales, productos, categorías) necesitan
 * varios días para poder comparar tendencias.
 */
const ANALYTICS_DAYS = 30;

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

  const analyticsFrom = new Date(startOfToday);
  analyticsFrom.setDate(analyticsFrom.getDate() - (ANALYTICS_DAYS - 1));

  const branchFilter = allowedBranchIds ? { in: allowedBranchIds } : undefined;

  const [sales, analyticsSales] = await Promise.all([
    prisma.posSale.findMany({
      where: {
        branchId: branchFilter,
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
    }),

    prisma.posSale.findMany({
      where: {
        branchId: branchFilter,
        createdAt: { gte: analyticsFrom },
        status: "COMPLETADA",
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        payments: { select: { method: true, amount: true } },
        items: {
          select: {
            name: true,
            quantity: true,
            lineTotal: true,
            variant: {
              select: {
                product: {
                  select: {
                    name: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SalesDashboardClient
      branches={branches}
      analyticsDays={ANALYTICS_DAYS}
      analytics={analyticsSales.map((s) => ({
        id: s.id,
        total: s.total,
        createdAt: s.createdAt.toISOString(),
        branch: s.branch,
        payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
        items: s.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          productName: i.variant?.product.name ?? null,
          categoryName: i.variant?.product.category.name ?? null,
        })),
      }))}
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
