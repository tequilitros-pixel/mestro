import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";
import { isBranchAllowed } from "@/lib/branches/access";
import { denominationTotal, validDenominationRows } from "@/lib/cash-cuts/denominations";
import { parseDateOnly } from "@/lib/dateOnly";

const ROLES_QUE_PUEDEN_ABRIR_CORTE = ["ADMIN", "GERENTE", "ENCARGADO"];
const CASH_CUT_STATUSES = ["ABIERTO", "CERRADO", "AUDITADO"] as const;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const scope = await getCashCutScope();

  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (status && !CASH_CUT_STATUSES.includes(status as (typeof CASH_CUT_STATUSES)[number])) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }
  if ((from && !DATE_ONLY_PATTERN.test(from)) || (to && !DATE_ONLY_PATTERN.test(to))) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  if (requestedBranchId && !isBranchAllowed(scope.branchIds, requestedBranchId)) {
    return NextResponse.json({ error: "No tienes acceso a esa sucursal." }, { status: 403 });
  }

  /*
   * withCashCutScope combina con AND, no fusionando objetos. Por eso un
   * ENCARGADO que pida ?status=CERRADO recibe lista vacia en vez de
   * historial: su alcance ya fija status ABIERTO y responsibleId propio,
   * y el filtro del querystring no puede sobreescribirlo.
   */
  const cashCuts = await prisma.cashCut.findMany({
    where: withCashCutScope(scope, {
      branchId: requestedBranchId,
      status: status as (typeof CASH_CUT_STATUSES)[number] | undefined,
      date: {
        gte: from ? parseDateOnly(from) : undefined,
        lte: to ? parseDateOnly(to) : undefined,
      },
    }),
    include: {
      branch: true,
      responsible: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
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

  const cashCut = await prisma.$transaction(async (tx) => {
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

  return NextResponse.json(cashCut, { status: 201 });
}
