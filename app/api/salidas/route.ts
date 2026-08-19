import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";
import { addDaysToDateOnly, businessDayStart } from "@/lib/dateOnly";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const concept = searchParams.get("concept")?.trim() ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if ((from && !DATE_ONLY_PATTERN.test(from)) || (to && !DATE_ONLY_PATTERN.test(to))) {
    return NextResponse.json({ error: "El rango de fechas no es válido." }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: "La fecha inicial no puede ser posterior a la final." }, { status: 400 });
  }
  const fromDate = from ? businessDayStart(from) : undefined;

  // La fecha final es inclusiva para que un filtro de un solo día incluya
  // todas las salidas capturadas durante ese día, no solo las de medianoche.
  const endExclusive = to ? businessDayStart(addDaysToDateOnly(to, 1)) : undefined;

  // GERENTE/ENCARGADO solo ven salidas de sus sucursales asignadas.
  const allowedBranchIds = await getAccessibleBranchIds();

  if (requestedBranchId && !isBranchAllowed(allowedBranchIds, requestedBranchId)) {
    return NextResponse.json({ error: "No tienes acceso a esa sucursal." }, { status: 403 });
  }

  const branchFilter = requestedBranchId ?? (allowedBranchIds ? { in: allowedBranchIds } : undefined);

  const outflows = await prisma.cashOutflow.findMany({
    where: {
      category: category ?? undefined,
      concept: concept ? { contains: concept, mode: "insensitive" } : undefined,
      occurredAt: { gte: fromDate, lt: endExclusive },
      cashCut: {
        branchId: branchFilter,
      },
    },
    include: {
      cashCut: {
        select: { code: true, branch: { select: { name: true } } },
      },
    },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json(outflows);
}
