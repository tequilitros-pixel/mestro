// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { getBranchSafeSummary, listEnvelopesForBranch } from "@/lib/cash-cuts/safeEnvelopes";

/**
 * GET /api/cash-cuts/safe/envelopes
 * Sin ?branchId: resumen por sucursal (para las tarjetas superiores).
 * Con ?branchId: sobres individuales de esa sucursal (para el
 * detalle al seleccionar una tarjeta).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  const { searchParams } = new URL(req.url);
  const requestedBranchId = searchParams.get("branchId");

  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
    }
    const envelopes = await listEnvelopesForBranch(requestedBranchId);
    return NextResponse.json(envelopes);
  }

  if (allowedBranchIds && allowedBranchIds.length === 0) {
    return NextResponse.json([]);
  }

  const branches = await prisma.branch.findMany({
    where: allowedBranchIds ? { id: { in: allowedBranchIds } } : {},
    select: { id: true },
  });

  const summaries = await Promise.all(
    branches.map((b) => getBranchSafeSummary(b.id))
  );

  return NextResponse.json(summaries);
}
