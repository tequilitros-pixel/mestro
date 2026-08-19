import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { addDaysToDateOnly, businessDayStart } from "@/lib/dateOnly";
import { withRlsContext } from "@/lib/rls";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ventas completadas de un rango de fechas, en el formato que usan las
 * pestañas visuales del dashboard (con producto/categoría por línea).
 * El filtro por sucursal de esas pestañas es local al cliente, así que
 * aquí solo se restringe a las sucursales a las que el usuario tiene
 * acceso.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (
    !dateFrom ||
    !dateTo ||
    !DATE_ONLY_PATTERN.test(dateFrom) ||
    !DATE_ONLY_PATTERN.test(dateTo) ||
    dateFrom > dateTo
  ) {
    return NextResponse.json({ error: "Rango de fechas requerido" }, { status: 400 });
  }

  const rangeStart = businessDayStart(dateFrom);
  const rangeEnd = businessDayStart(addDaysToDateOnly(dateTo, 1));

  const sales = await withRlsContext(user, (tx) => tx.posSale.findMany({
    where: {
      branchId: allowedBranchIds ? { in: allowedBranchIds } : undefined,
      createdAt: { gte: rangeStart, lt: rangeEnd },
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
  }));

  return NextResponse.json(
    sales.map((s) => ({
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
    })),
  );
}
