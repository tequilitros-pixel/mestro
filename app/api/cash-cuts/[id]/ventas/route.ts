import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";

const ROLES_QUE_PUEDEN_EDITAR = ["ADMIN", "GERENTE", "ENCARGADO"];

const METODOS_VALIDOS = [
  "EFECTIVO",
  "TARJETA",
  "TRANSFERENCIA",
  "DIDI",
  "UBER",
  "RAPPI",
  "VALES",
  "OTRO",
];

async function recalcularTotalVentas(cashCutId: string) {
  const ventas = await prisma.cashSalePayment.findMany({ where: { cashCutId } });
  const totalSales = ventas.reduce((sum, v) => sum + v.amount, 0);
  await prisma.cashCut.update({
    where: { id: cashCutId },
    data: { totalSales },
  });
  return totalSales;
}

async function checkAccessToCut(userId: string, role: string, cashCutId: string) {
  /*
   * El alcance se resuelve desde la sesion, no desde los parametros.
   * Los argumentos solo se usan para comprobar que coinciden con la
   * sesion real; si no, se rechaza.
   */
  const scope = await getCashCutScope();
  if (!scope || scope.user.id !== userId || scope.user.role !== role) {
    return { ok: false, status: 401 as const, error: "No autorizado", cashCut: null };
  }

  const cashCut = await prisma.cashCut.findFirst({
    where: withCashCutScope(scope, { id: cashCutId }),
    select: { branchId: true, status: true },
  });

  if (!cashCut) {
    return { ok: false, status: 404 as const, error: "Corte no encontrado", cashCut: null };
  }


  return { ok: true as const, cashCut };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_QUE_PUEDEN_EDITAR.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  }

  const { id: cashCutId } = await params;

  const access = await checkAccessToCut(user.id, user.role, cashCutId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

   if (access.cashCut!.status !== "ABIERTO") {

    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 403 });
  }

  const body = await request.json();
  const { method, amount, notes } = body;

  if (
    !METODOS_VALIDOS.includes(method) ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return NextResponse.json({ error: "method inválido o amount faltante" }, { status: 400 });
  }

  const venta = await prisma.cashSalePayment.upsert({
    where: { cashCutId_method: { cashCutId, method } },
    update: { amount, notes },
    create: { cashCutId, method, amount, notes },
  });

  const totalSales = await recalcularTotalVentas(cashCutId);

  return NextResponse.json({ venta, totalSales });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: cashCutId } = await params;

  const access = await checkAccessToCut(user.id, user.role, cashCutId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const ventas = await prisma.cashSalePayment.findMany({ where: { cashCutId } });

  return NextResponse.json(ventas);
}
