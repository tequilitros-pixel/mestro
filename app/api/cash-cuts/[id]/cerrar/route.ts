// PENDIENTE DE SCHEMA -- NO REEMPLAZAR EL ARCHIVO REAL TODAVIA.
// Reemplazo listo de app/api/cash-cuts/[id]/cerrar/route.ts para
// aplicar en el MISMO PR que la migracion de sobres. Aplicar antes
// rompe el cierre de corte en produccion (referencia un modelo que
// no existe).
//
// Unico cambio real contra el original: el bloque que creaba un
// CashSafeMovement DEPOSITO_SOBRE (nivel sucursal) ahora crea el
// sobre identificable (nivel corte) via createEnvelopeForCashCut,
// DENTRO de la misma transaccion de cierre -- mismo patron de
// idempotencia que ya usa el resto de esta ruta con
// clientOperationId.
//
// CashSafeMovement se deja de escribir en el flujo nuevo a
// proposito: es lo que permite que el saldo legado se congele solo,
// sin necesidad de una fecha de "cutover" -- ver DISENO.md #3.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";
import { denominationTotal, validDenominationRows } from "@/lib/cash-cuts/denominations";
import { createEnvelopeForCashCut } from "@/lib/cash-cuts/safeEnvelopes";

const ROLES_QUE_PUEDEN_CERRAR = ["ADMIN", "GERENTE", "ENCARGADO"];

class CashCutAlreadyClosedError extends Error {
  constructor() {
    super("Este corte ya esta cerrado");
  }
}

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

  const scope = await getCashCutScope();
  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Fuera de alcance e inexistente responden igual: no se revela
  // que el corte existe ni a que sucursal pertenece.
  const cashCut = await prisma.cashCut.findFirst({
    where: withCashCutScope(scope, { id: cashCutId }),
    include: { salesByMethod: true, branch: { select: { code: true } } },
  });

  if (!cashCut) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
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
    closingMode,
    clientOperationId,
    clientCreatedAt,
  } = body;

  if (cashCut.status !== "ABIERTO") {
    if (clientOperationId) return NextResponse.json({ cashCut, duplicate: true });
    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 403 });
  }

  const countThenEnvelope = closingMode === "COUNT_THEN_ENVELOPE";
  const validCashCounted =
    typeof cashCounted === "number" && Number.isFinite(cashCounted) && cashCounted >= 0;
  const validNextFund =
    typeof nextFund === "number" && Number.isFinite(nextFund) && nextFund >= 0;
  if (!validCashCounted || (!countThenEnvelope && !validNextFund)) {
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

  const countedRows = validDenominationRows(cashCountedDenominations);
  const countedFromDenominations = denominationTotal(countedRows);
  if (countThenEnvelope && Math.abs(Number(cashCounted) - countedFromDenominations) > 0.001) {
    return NextResponse.json(
      { error: "El total contado no coincide con las denominaciones." },
      { status: 400 },
    );
  }
  if (
    countThenEnvelope &&
    (typeof envelopeAmount !== "number" ||
      !Number.isFinite(envelopeAmount) ||
      envelopeAmount < 0 ||
      envelopeAmount > cashCounted)
  ) {
    return NextResponse.json(
      { error: "El sobre debe estar entre $0 y el efectivo contado." },
      { status: 400 },
    );
  }

  const finalCashCounted = cashCounted;
  const finalEnvelopeAmount = envelopeAmount;
  const finalNextFund = countThenEnvelope
    ? Math.max(0, cashCounted - envelopeAmount)
    : nextFund;
  const denominationRows = countThenEnvelope
    ? countedRows.map((row) => ({ context: "CIERRE" as const, ...row }))
    : [
        ...toDenominationRows("CIERRE", cashCountedDenominations),
        ...toDenominationRows("SIGUIENTE_TURNO", nextFundDenominations),
      ];
  const difference = finalCashCounted - cashExpected;

  const netProfit =
    totalCostOfGoods !== undefined
      ? totalSales - totalCostOfGoods - totalOutflows
      : null;

  const assignedCash = (finalEnvelopeAmount ?? 0) + finalNextFund;
  const assignmentWarning =
    Math.abs(assignedCash - finalCashCounted) > 1
      ? `El sobre + fondo siguiente ($${assignedCash}) no coincide con lo contado ($${finalCashCounted}).`
      : null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // La lectura exterior solamente valida acceso y reduce trabajo. Este
      // lock es la autoridad para el cierre: un segundo POST espera al
      // primero y, cuando obtiene la fila, ya ve CERRADO sin crear otro
      // audit entry, denominaciones ni sobre.
      const lockedCuts = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status"
        FROM "CashCut"
        WHERE "id" = ${cashCutId}
        FOR UPDATE
      `;
      if (lockedCuts[0]?.status !== "ABIERTO") {
        throw new CashCutAlreadyClosedError();
      }

      const cut = await tx.cashCut.update({
        where: { id: cashCutId },
        data: {
          cashCounted: finalCashCounted,
          cashExpected,
          difference,
          envelopeAmount: finalEnvelopeAmount,
          envelopeNumber,
          envelopeNotes,
          nextFund: finalNextFund,
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
          // Ya NO se crea CashSafeMovement aqui -- ver nota de
          // cabecera. El sobre identificable es ahora la unica
          // fuente para dinero mandado a caja fuerte.
        },
      });

      if (finalEnvelopeAmount && finalEnvelopeAmount > 0) {
        await createEnvelopeForCashCut(tx, {
          cashCutId,
          branchId: cut.branchId,
          branchCode: cashCut.branch.code,
          cutDate: cut.date,
          amount: finalEnvelopeAmount,
          userId: user.id,
        });
      }

      return cut;
    });

    return NextResponse.json({ cashCut: updated, assignmentWarning });
  } catch (error) {
    if (!(error instanceof CashCutAlreadyClosedError)) throw error;

    const current = await prisma.cashCut.findFirst({
      where: withCashCutScope(scope, { id: cashCutId }),
    });
    if (clientOperationId && current) {
      return NextResponse.json({ cashCut: current, duplicate: true });
    }
    return NextResponse.json({ error: "Este corte ya está cerrado" }, { status: 409 });
  }
}
