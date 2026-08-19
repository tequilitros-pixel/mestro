import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";

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

  const access = await checkAccessToCut(user.id, user.role, cashCutId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

    if (access.cashCut!.status !== "ABIERTO") {

    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 403 });
  }

  const body = await request.json();
  const { concept, category, amount, authorizedById, notes, receiptPhotoUrl, clientOperationId, clientCreatedAt } = body;

  if (clientOperationId) {
    const existing = await prisma.cashOutflow.findUnique({ where: { id: clientOperationId } });
    if (existing) {
      if (existing.cashCutId !== cashCutId) {
        return NextResponse.json({ error: "La operación ya pertenece a otro corte." }, { status: 409 });
      }
      return NextResponse.json({ salida: existing, totalOutflows: await recalcularTotalSalidas(cashCutId) });
    }
  }

  if (!concept || !category || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Faltan datos: concept, category, amount" },
      { status: 400 }
    );
  }

  const occurredAt = clientCreatedAt ? new Date(clientCreatedAt) : null;
  if (occurredAt && Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: "Fecha de salida inválida" }, { status: 400 });
  const salida = await prisma.cashOutflow.create({
    data: {
      cashCutId,
      concept,
      category,
      amount,
      authorizedById: authorizedById ?? null,
      notes,
      receiptPhotoUrl,
      ...(clientOperationId ? { id: clientOperationId } : {}),
      ...(occurredAt ? { occurredAt, createdAt: occurredAt } : {}),
    },
  });

  const totalOutflows = await recalcularTotalSalidas(cashCutId);

  return NextResponse.json({ salida, totalOutflows }, { status: 201 });
}
