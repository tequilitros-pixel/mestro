// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/[id]/withdraw/route.ts
import { NextResponse } from "next/server";
import { getCurrentUserWithAnyModuleAccess, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withdrawFromEnvelope } from "@/lib/cash-cuts/safeEnvelopes";
import { canAccessSafeEnvelopeDate, resolveSafeEnvelopeWeek } from "@/lib/cash-cuts/safeWeek";

/**
 * body: { amount: number, reason: string } -> retiro parcial
 * body: { full: true, reason: string }     -> retira el saldo completo
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserWithAnyModuleAccess(["/cash-cuts/safe"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const envelope = await prisma.cashSafeEnvelope.findUnique({ where: { id } });
  if (!envelope) {
    return NextResponse.json({ error: "Sobre no encontrado" }, { status: 404 });
  }
  if (!canAccessSafeEnvelopeDate(user.role, envelope.cutDate)) return NextResponse.json({ error: "Sobre no encontrado" }, { status: 404 });

  const allowedBranchIds = await getAccessibleBranchIds();
  if (allowedBranchIds && !allowedBranchIds.includes(envelope.branchId)) {
    return NextResponse.json({ error: "Sobre no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { amount, full, reason, categoryId } = body;

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "El motivo del retiro es obligatorio" }, { status: 400 });
  }

  try {
    const updated = await withdrawFromEnvelope({
      envelopeId: id,
      amount: typeof amount === "number" ? amount : undefined,
      full: full === true,
      reason,
      categoryId: typeof categoryId === "string" ? categoryId : undefined,
      receiptPhotoUrl: typeof body.receiptPhotoUrl === "string" ? body.receiptPhotoUrl : undefined,
      userId: user.id,
      allowedBranchIds,
      currentWeek: user.role === "ADMIN" ? null : resolveSafeEnvelopeWeek(null, user.role),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo registrar el retiro" },
      { status: 400 }
    );
  }
}
