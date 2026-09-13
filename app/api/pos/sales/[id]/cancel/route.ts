import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelPosSaleAtomic } from "@/lib/pos/cancelSale";

const ROLES_QUE_PUEDEN_CANCELAR = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_CANCELAR.includes(user.role)) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar ventas" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const cancelReason = typeof body?.reason === "string" ? body.reason.trim() : null;
  const operationId = typeof body?.clientOperationId === "string" ? body.clientOperationId : undefined;
  if (operationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    return NextResponse.json({ error: "El identificador de operación no es válido." }, { status: 400 });
  }
  const result = await cancelPosSaleAtomic({ saleId: id, user, reason: cancelReason || null, operationId });
  if (result.kind === "not_found") return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  if (result.kind === "closed_cut") return NextResponse.json({ error: "El corte de caja de esta venta ya está cerrado. Solo un administrador puede cancelarla." }, { status: 403 });
  return NextResponse.json({ ...result.sale, duplicate: result.kind === "duplicate" });
}
