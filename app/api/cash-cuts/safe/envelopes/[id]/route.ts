// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/[id]/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { getEnvelopeWithMovements } from "@/lib/cash-cuts/safeEnvelopes";

/** GET: detalle de un sobre con su historial completo de movimientos. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const envelope = await getEnvelopeWithMovements(id);
  if (!envelope) {
    return NextResponse.json({ error: "Sobre no encontrado" }, { status: 404 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  if (allowedBranchIds && !allowedBranchIds.includes(envelope.branch.id)) {
    return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
  }

  return NextResponse.json(envelope);
}
