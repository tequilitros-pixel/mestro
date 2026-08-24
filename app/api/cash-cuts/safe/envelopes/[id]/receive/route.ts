// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/[id]/receive/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReceive, receiveEnvelope } from "@/lib/cash-cuts/safeEnvelopes";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canReceive(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para recibir sobres" }, { status: 403 });
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
  const receivedAmount = body.receivedAmount;
  if (typeof receivedAmount !== "number" || !Number.isFinite(receivedAmount) || receivedAmount < 0) {
    return NextResponse.json({ error: "Captura la cantidad recibida" }, { status: 400 });
  }

  try {
    const updated = await receiveEnvelope({ envelopeId: id, receivedAmount, userId: user.id });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo recibir el sobre" },
      { status: 400 }
    );
  }
}
