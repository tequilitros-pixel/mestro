import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["ADMIN", "GERENTE", "ENCARGADO"];

const TIPOS_VALIDOS = ["CAMBIO_RECIBIDO", "REEMBOLSO", "AJUSTE", "PRESTAMO", "OTRO"];

async function recalcularTotalEntradas(cashCutId: string) {
  const entradas = await prisma.cashInflow.findMany({ where: { cashCutId } });
  const totalInflows = entradas.reduce((sum, e) => sum + e.amount, 0);
  await prisma.cashCut.update({
    where: { id: cashCutId },
    data: { totalInflows },
  });
  return totalInflows;
}

async function checkAccessToCut(userId: string, role: string, cashCutId: string) {
  const cashCut = await prisma.cashCut.findUnique({
    where: { id: cashCutId },
    select: { branchId: true, status: true },
  });

  if (!cashCut) {
    return { ok: false, status: 404 as const, error: "Corte no encontrado", cashCut: null };
  }

  if (role === "GERENTE" || role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId, branchId: cashCut.branchId },
    });
    if (!hasAccess) {
      return { ok: false, status: 403 as const, error: "No autorizado", cashCut: null };
    }
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

  const entradas = await prisma.cashInflow.findMany({
    where: { cashCutId },
    orderBy: { occurredAt: "asc" },
  });

  return NextResponse.json(entradas);
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
  const { type, amount, notes, clientOperationId, clientCreatedAt } = body;

  if (clientOperationId) {
    const existing = await prisma.cashInflow.findUnique({ where: { id: clientOperationId } });
    if (existing) return NextResponse.json({ entrada: existing, totalInflows: await recalcularTotalEntradas(cashCutId) });
  }

  if (!TIPOS_VALIDOS.includes(type) || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "type inválido o amount faltante" }, { status: 400 });
  }

  const occurredAt = clientCreatedAt ? new Date(clientCreatedAt) : null;
  if (occurredAt && Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: "Fecha de entrada inválida" }, { status: 400 });
  const entrada = await prisma.cashInflow.create({
    data: { ...(clientOperationId ? { id: clientOperationId } : {}), cashCutId, type, amount, notes, ...(occurredAt ? { occurredAt, createdAt: occurredAt } : {}) },
  });

  const totalInflows = await recalcularTotalEntradas(cashCutId);

  return NextResponse.json({ entrada, totalInflows }, { status: 201 });
}
