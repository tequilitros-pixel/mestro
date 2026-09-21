import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutReadScope, withCashCutScope } from "@/lib/cash-cuts/access";
import { isBranchAllowed } from "@/lib/branches/access";
import { denominationTotal, validDenominationRows } from "@/lib/cash-cuts/denominations";
import { parseDateOnly } from "@/lib/dateOnly";
import {
  CASH_CUT_PERIODS,
  type CashCutPeriod,
  getCashCutPeriodRange,
  getCashCutRangeVisibilityWhere,
} from "@/lib/cash-cuts/readScope";

const ROLES_QUE_PUEDEN_ABRIR_CORTE = ["ADMIN", "GERENTE", "ENCARGADO"];
const CASH_CUT_STATUSES = ["ABIERTO", "CERRADO", "AUDITADO"] as const;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string | null): value is string {
  if (!value || !DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = parseDateOnly(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

class OpenCashCutAlreadyExistsError extends Error {
  constructor(
    public readonly cashCut: { id: string; code: string },
  ) {
    super("Esta sucursal ya tiene un corte abierto.");
  }
}

export async function GET(request: Request) {
  const scope = await getCashCutScope();

  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const period = searchParams.get("period") ?? "current-week";
  const query = searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const isGlobalAdmin = scope.user.role === "ADMIN" && scope.branchIds === null;

  if (status && !CASH_CUT_STATUSES.includes(status as (typeof CASH_CUT_STATUSES)[number])) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }
  if (!CASH_CUT_PERIODS.includes(period as CashCutPeriod)) {
    return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  }
  if (!isGlobalAdmin && (period !== "current-week" || from || to)) {
    return NextResponse.json(
      { error: "Solo el administrador puede consultar periodos históricos." },
      { status: 403 },
    );
  }
  if (period === "custom" && (!isValidDateOnly(from) || !isValidDateOnly(to))) {
    return NextResponse.json({ error: "Selecciona una fecha inicial y final válidas." }, { status: 400 });
  }
  if (period !== "custom" && (from || to)) {
    return NextResponse.json({ error: "Las fechas solo aplican al periodo personalizado." }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: "La fecha inicial no puede ser posterior a la final." }, { status: 400 });
  }

  if (requestedBranchId && !isGlobalAdmin && requestedBranchId !== scope.workingBranchId) {
    return NextResponse.json({ error: "Solo puedes consultar la sucursal de trabajo actual." }, { status: 403 });
  }
  if (requestedBranchId && isGlobalAdmin) {
    const branchExists = await prisma.branch.findFirst({
      where: { id: requestedBranchId, active: true },
      select: { id: true },
    });
    if (!branchExists) {
      return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
    }
  }

  const range = getCashCutPeriodRange(period as CashCutPeriod, {
    from: from ?? undefined,
    to: to ?? undefined,
  });

  /*
   * withCashCutReadScope combina con AND y conserva el alcance del rol.
   * Para ADMIN la ruta agrega el periodo y la sucursal solicitados; para
   * los demás roles el propio alcance sigue fijando sucursal y semana.
   */
  const cashCuts = await prisma.cashCut.findMany({
    where: withCashCutReadScope(scope, {
      AND: [
        requestedBranchId ? { branchId: requestedBranchId } : {},
        getCashCutRangeVisibilityWhere(range),
        status ? { status: status as (typeof CASH_CUT_STATUSES)[number] } : {},
        query
          ? {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { responsible: { is: { name: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {},
      ],
    }),
    include: {
      branch: true,
      responsible: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { openedAt: "desc" }],
  });

  return NextResponse.json(cashCuts);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_ABRIR_CORTE.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para abrir un corte" }, { status: 403 });
  }

  const body = await request.json();
  const {
    branchId,
    date,
    startingFund,
    responsibleId,
    startingFundDenominations,
    eventId,
    clientOperationId,
    clientCreatedAt,
  } = body;

  if (
    !branchId ||
    typeof date !== "string" ||
    !DATE_ONLY_PATTERN.test(date) ||
    typeof startingFund !== "number" ||
    !Number.isFinite(startingFund) ||
    startingFund < 0
  ) {
    return NextResponse.json({ error: "Faltan datos: branchId, date, startingFund" }, { status: 400 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  if (!isBranchAllowed(allowedBranchIds, branchId)) {
    return NextResponse.json({ error: "No tienes acceso a esa sucursal." }, { status: 403 });
  }

  // El chequeo de idempotencia va DESPUÉS de validar acceso a la
  // sucursal: si no, un clientOperationId adivinado o reutilizado
  // podría devolver los datos de un corte de otra sucursal.
  if (clientOperationId) {
    /*
     * Acotado por alcance: si no, un clientOperationId adivinado dejaria
     * a un ENCARGADO confirmar la existencia de un corte cerrado o ajeno
     * de su misma sucursal, y recibir sus datos.
     */
    const scopeForReuse = await getCashCutScope();
    const existing = scopeForReuse
      ? await prisma.cashCut.findFirst({
          where: withCashCutScope(scopeForReuse, { id: clientOperationId }),
        })
      : null;
    if (existing) {
      return NextResponse.json(existing);
    }
  }

  const event = eventId
    ? await prisma.serviceEvent.findUnique({
        where: { id: eventId },
        include: { items: true },
      })
    : null;

  if (eventId) {
    if (!event) {
      return NextResponse.json({ error: "El evento seleccionado no existe." }, { status: 404 });
    }

    if (event.stockDeductedAt) {
      return NextResponse.json(
        { error: "El inventario de este evento ya fue descontado en otro corte." },
        { status: 400 }
      );
    }
  }

  const openingRows = validDenominationRows(startingFundDenominations);
  const denominationRows = openingRows.map((row) => ({
    context: "APERTURA" as const,
    ...row,
  }));
  if (
    Array.isArray(startingFundDenominations) &&
    Math.abs(Number(startingFund) - denominationTotal(openingRows)) > 0.001
  ) {
    return NextResponse.json({ error: "El total no coincide con las denominaciones." }, { status: 400 });
  }

  // Código legible: CC-<CODIGO_SUCURSAL>-<FECHA>-<consecutivo del día>
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const dayCount = await prisma.cashCut.count({
    where: { branchId, date: parseDateOnly(date) },
  });
  const code = clientOperationId
    ? `CC-${branch.code}-${clientOperationId.replace(/-/g, "").slice(0, 10).toUpperCase()}`
    : `CC-${branch.code}-${date}-${String(dayCount + 1).padStart(2, "0")}`;
  const openedAt = clientCreatedAt ? new Date(clientCreatedAt) : new Date();
  if (Number.isNaN(openedAt.getTime())) return NextResponse.json({ error: "Fecha de apertura inválida" }, { status: 400 });

  let cashCut;
  try {
    cashCut = await prisma.$transaction(async (tx) => {
      // Serializa aperturas por sucursal. El historial contiene cortes
      // abiertos antiguos, pero desde este punto no permitimos que una
      // segunda apertura vuelva ambiguo a qué caja deben ir las ventas.
      const lockKey = `cash-cut-open:${branchId}`;
      await tx.$queryRaw<Array<{ lock: string }>>`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lock"
      `;
      const existingOpen = await tx.cashCut.findFirst({
        where: { branchId, status: "ABIERTO" },
        orderBy: { openedAt: "desc" },
        select: { id: true, code: true },
      });
      if (existingOpen) throw new OpenCashCutAlreadyExistsError(existingOpen);

      const created = await tx.cashCut.create({
      data: {
        ...(clientOperationId ? { id: clientOperationId } : {}),
        code,
        branchId,
        date: parseDateOnly(date),
        startingFund,
        responsibleId: responsibleId ?? user.id,
        createdById: user.id,
        status: "ABIERTO",
        openedAt,
        createdAt: openedAt,
        eventId: event?.id,
        auditEntries: {
          create: {
            action: "CREADO",
            userId: user.id,
          },
        },
        ...(denominationRows.length > 0
          ? { denominations: { create: denominationRows } }
          : {}),
      },
    });

    // Si se vinculó un evento, descuenta del inventario de esta
    // sucursal lo que se cargó a ese evento (lo enviado, o lo
    // planeado si aún no se registró envío).
    if (event) {
      for (const item of event.items) {
        const quantity = Number(item.sentQuantity ?? item.plannedQuantity);

        if (!(quantity > 0)) continue;

        await tx.inventoryEntry.create({
          data: {
            branchId,
            productId: item.productId,
            type: "SALIDA_EVENTO",
            quantity: -quantity,
            notes: `Evento ${event.code} — ${event.clientName}`,
          },
        });
      }

      await tx.serviceEvent.update({
        where: { id: event.id },
        data: { stockDeductedAt: new Date() },
      });
    }

      return created;
    });
  } catch (error) {
    if (error instanceof OpenCashCutAlreadyExistsError) {
      return NextResponse.json(
        {
          error: `Esta sucursal ya tiene un corte abierto (${error.cashCut.code}). Continúa ese corte antes de abrir otro.`,
          cashCut: error.cashCut,
        },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json(cashCut, { status: 201 });
}
