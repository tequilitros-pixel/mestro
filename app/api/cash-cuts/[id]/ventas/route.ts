import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

  const cashCut = await prisma.cashCut.findUnique({ where: { id: cashCutId } });
  if (!cashCut) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }
  if (cashCut.status !== "ABIERTO") {
    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 403 });
  }

  const body = await request.json();
  const { method, amount, notes } = body;

  if (!METODOS_VALIDOS.includes(method) || typeof amount !== "number") {
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
  const ventas = await prisma.cashSalePayment.findMany({ where: { cashCutId } });

  return NextResponse.json(ventas);
}
