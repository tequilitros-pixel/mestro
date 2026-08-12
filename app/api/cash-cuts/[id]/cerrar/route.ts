import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_CERRAR = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_QUE_PUEDEN_CERRAR.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para cerrar este corte" }, { status: 403 });
  }

  const { id: cashCutId } = await params;

  const cashCut = await prisma.cashCut.findUnique({
    where: { id: cashCutId },
    include: { salesByMethod: true },
  });

  if (!cashCut) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }
    if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: cashCut.branchId },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }


  const body = await request.json();
  const {
    cashCounted,
    envelopeAmount,
    envelopeNumber,
    envelopeNotes,
    nextFund,
    totalCostOfGoods,
    cashCountedDenominations,
    nextFundDenominations,
    clientOperationId,
    clientCreatedAt,
  } = body;

  if (cashCut.status !== "ABIERTO") {
    if (clientOperationId) return NextResponse.json({ cashCut, duplicate: true });
    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 403 });
  }

  if (typeof cashCounted !== "number" || typeof nextFund !== "number") {
    return NextResponse.json(
      { error: "Faltan datos: cashCounted y nextFund son obligatorios" },
      { status: 400 }
    );
  }
  const closedAt = clientCreatedAt ? new Date(clientCreatedAt) : new Date();
  if (Number.isNaN(closedAt.getTime())) return NextResponse.json({ error: "Fecha de cierre inválida" }, { status: 400 });

  function toDenominationRows(
    context: "CIERRE" | "SIGUIENTE_TURNO",
    input: unknown
  ) {
    if (!Array.isArray(input)) return [];

    return input
      .filter(
        (d: { value?: number; quantity?: number }) =>
          typeof d?.value === "number" &&
          typeof d?.quantity === "number" &&
          d.quantity > 0
      )
      .map((d: { value: number; quantity: number }) => ({
        context,
        value: d.value,
        quantity: d.quantity,
      }));
  }

  const denominationRows = [
    ...toDenominationRows("CIERRE", cashCountedDenominations),
    ...toDenominationRows("SIGUIENTE_TURNO", nextFundDenominations),
  ];

  const [outflows, inflows] = await Promise.all([
    prisma.cashOutflow.findMany({ where: { cashCutId } }),
    prisma.cashInflow.findMany({ where: { cashCutId } }),
  ]);

  const totalOutflows = outflows.reduce((sum, o) => sum + o.amount, 0);
  const totalInflows = inflows.reduce((sum, i) => sum + i.amount, 0);
  const totalSales = cashCut.salesByMethod.reduce((sum, s) => sum + s.amount, 0);

  const cashSales =
    cashCut.salesByMethod.find((s) => s.method === "EFECTIVO")?.amount ?? 0;

  const cashExpected =
    cashCut.startingFund + cashSales + totalInflows - totalOutflows;

  const difference = cashCounted - cashExpected;

  const netProfit =
    totalCostOfGoods !== undefined
      ? totalSales - totalCostOfGoods - totalOutflows
      : null;

  const assignedCash = (envelopeAmount ?? 0) + nextFund;
  const assignmentWarning =
    Math.abs(assignedCash - cashCounted) > 1
      ? `El sobre + fondo siguiente ($${assignedCash}) no coincide con lo contado ($${cashCounted}).`
      : null;

  const updated = await prisma.cashCut.update({
    where: { id: cashCutId },
    data: {
      cashCounted,
      cashExpected,
      difference,
      envelopeAmount,
      envelopeNumber,
      envelopeNotes,
      nextFund,
      totalSales,
      totalOutflows,
      totalInflows,
      totalCostOfGoods: totalCostOfGoods ?? null,
      netProfit,
      status: "CERRADO",
      closedAt,
      updatedById: user.id,
      auditEntries: {
        create: {
          action: "CERRADO",
          userId: user.id,
          newValue: `diferencia: ${difference}`,
        },
      },
      ...(denominationRows.length > 0
        ? { denominations: { create: denominationRows } }
        : {}),
      ...(envelopeAmount && envelopeAmount > 0
        ? {
            safeMovements: {
              create: {
                branchId: cashCut.branchId,
                type: "DEPOSITO_SOBRE",
                amount: envelopeAmount,
                userId: user.id,
                notes: envelopeNumber ? `Sobre #${envelopeNumber}` : undefined,
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ cashCut: updated, assignmentWarning });
}
