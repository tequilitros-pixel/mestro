// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/[id]/withdraw/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWithdraw, withdrawFromEnvelope } from "@/lib/cash-cuts/safeEnvelopes";

/**
 * body: { amount: number, reason: string } -> retiro parcial
 * body: { full: true, reason: string }     -> retira el saldo completo
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canWithdraw(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para retirar" }, { status: 403 });
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
  const { amount, full, reason } = body;

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "El motivo del retiro es obligatorio" }, { status: 400 });
  }

  try {
    const updated = await withdrawFromEnvelope({
      envelopeId: id,
      amount: typeof amount === "number" ? amount : undefined,
      full: full === true,
      reason,
      userId: user.id,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo registrar el retiro" },
      { status: 400 }
    );
  }
}
