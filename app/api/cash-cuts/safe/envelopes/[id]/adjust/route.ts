// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/[id]/adjust/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdjust, adjustEnvelope } from "@/lib/cash-cuts/safeEnvelopes";

/** body: { delta: number, reason: string } -- delta puede ser negativo */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAdjust(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para hacer ajustes" }, { status: 403 });
  }

  const { id } = await params;
  const envelope = await prisma.cashSafeEnvelope.findUnique({ where: { id } });
  if (!envelope) {
    return NextResponse.json({ error: "Sobre no encontrado" }, { status: 404 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  if (allowedBranchIds && !allowedBranchIds.includes(envelope.branchId)) {
    return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { delta, reason } = body;

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "El motivo del ajuste es obligatorio" }, { status: 400 });
  }
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Captura un ajuste distinto de cero" }, { status: 400 });
  }

  try {
    const updated = await adjustEnvelope({ envelopeId: id, delta, reason, userId: user.id });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo aplicar el ajuste" },
      { status: 400 }
    );
  }
}
