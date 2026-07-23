import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const cashCut = await prisma.cashCut.findUnique({
    where: { id },
    include: {
      branch: true,
      responsible: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      salesByMethod: true,
      outflows: { orderBy: { occurredAt: "asc" } },
      inflows: { orderBy: { occurredAt: "asc" } },
      evidences: true,
      auditEntries: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!cashCut) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }

  // GERENTE/ENCARGADO solo pueden ver cortes de sus sucursales asignadas.
  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: cashCut.branchId },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  return NextResponse.json(cashCut);
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

  const existing = await prisma.cashCut.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
  }

  if (existing.status !== "ABIERTO" && user.role !== "ADMIN") {
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
