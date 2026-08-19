import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteCashCut, getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";

const ROLES_QUE_PUEDEN_EDITAR = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await getCashCutScope();
  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  /*
   * La autorizacion va DENTRO del where, no en un if posterior. Asi un
   * corte fuera de alcance es indistinguible de uno inexistente: se
   * responde 404 y no se revela que existe ni de que sucursal es.
   */
  let cashCut;
  try {
    cashCut = await prisma.cashCut.findFirst({
      where: withCashCutScope(scope, { id }),
      include: {
        branch: true,
        responsible: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        salesByMethod: true,
        outflows: { orderBy: { occurredAt: "asc" } },
        inflows: { orderBy: { occurredAt: "asc" } },
        evidences: true,
        auditEntries: { orderBy: { createdAt: "desc" }, take: 20 },
        denominations: { orderBy: { value: "desc" } },
        posSales: {
          where: { status: "COMPLETADA" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            subtotal: true,
            discountAmount: true,
            total: true,
            createdAt: true,
            soldBy: { select: { id: true, name: true } },
            items: {
              select: {
                id: true,
                name: true,
                description: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            code: true,
            clientName: true,
            location: true,
            eventDate: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching cash cut:", error);
    return NextResponse.json(
      {
        error: "Error al consultar el corte.",
      },
      { status: 500 }
    );
  }

  if (!cashCut) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ...cashCut,
    evidences: cashCut.evidences.map((evidence) => ({
      ...evidence,
      url: evidence.url.startsWith("http")
        ? evidence.url
        : `/api/cash-cuts/${id}/evidencias/${evidence.id}/file?name=${encodeURIComponent(evidence.url)}`,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para editar este corte" }, { status: 403 });
  }

  const { id } = await params;

  const scope = await getCashCutScope();
  if (!scope) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const existing = await prisma.cashCut.findFirst({
    where: withCashCutScope(scope, { id }),
  });
  if (!existing) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }

  // ADMIN conserva su capacidad de corregir cortes ya cerrados.
  if (!canWriteCashCut(scope, existing) && scope.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Este corte ya está cerrado. Solo un administrador puede editarlo." },
      { status: 403 }
    );
  }

  const body = await request.json();

  // Solo permitimos editar estos campos por esta vía.
  // (Las ventas/salidas/entradas van por sus propias rutas.)
  const EDITABLE_FIELDS = [
    "nextFund",
    "cashCounted",
    "envelopeAmount",
    "envelopeNumber",
    "envelopeNotes",
    "notes",
  ] as const;

  const data: Record<string, unknown> = {};
  const auditEntries: { action: string; field: string; oldValue: string; newValue: string }[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    const oldValue = existing[field as keyof typeof existing];
    if (oldValue !== body[field]) {
      data[field] = body[field];
      auditEntries.push({
        action: "EDITADO",
        field,
        oldValue: String(oldValue ?? ""),
        newValue: String(body[field]),
      });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(existing);
  }

  const updated = await prisma.cashCut.update({
    where: { id },
    data: {
      ...data,
      updatedById: user.id,
      auditEntries: {
        create: auditEntries.map((entry) => ({ ...entry, userId: user.id })),
      },
    },
  });

  return NextResponse.json(updated);
}
