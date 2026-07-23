import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["ADMIN", "GERENTE", "ENCARGADO"];

async function recalcularTotalSalidas(cashCutId: string) {
  const salidas = await prisma.cashOutflow.findMany({ where: { cashCutId } });
  const totalOutflows = salidas.reduce((sum, s) => sum + s.amount, 0);
  await prisma.cashCut.update({
    where: { id: cashCutId },
    data: { totalOutflows },
  });
  return totalOutflows;
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
  const salidas = await prisma.cashOutflow.findMany({
    where: { cashCutId },
    orderBy: { occurredAt: "asc" },
  });

  return NextResponse.json(salidas);
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
  const { concept, category, amount, authorizedById, notes, receiptPhotoUrl } = body;

  if (!concept || !category || typeof amount !== "number") {
    return NextResponse.json(
      { error: "Faltan datos: concept, category, amount" },
      { status: 400 }
    );
  }

  const salida = await prisma.cashOutflow.create({
    data: {
      cashCutId,
      concept,
      category,
      amount,
      authorizedById: authorizedById ?? null,
      notes,
      receiptPhotoUrl,
    },
  });

  const totalOutflows = await recalcularTotalSalidas(cashCutId);

  return NextResponse.json({ salida, totalOutflows }, { status: 201 });
}
