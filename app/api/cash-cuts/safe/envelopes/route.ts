// PENDIENTE DE SCHEMA -- ver lib/cash-cuts/safeEnvelopes.ts
// Destino: app/api/cash-cuts/safe/envelopes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithAnyModuleAccess, getAccessibleBranchIds } from "@/lib/auth";
import { getBranchSafeSummary, listEnvelopesForBranch } from "@/lib/cash-cuts/safeEnvelopes";
import { currentBusinessWeekRange } from "@/lib/cash-cuts/access";
import { resolveSafeEnvelopeWeek, SafeEnvelopeWeekError } from "@/lib/cash-cuts/safeWeek";

/**
 * GET /api/cash-cuts/safe/envelopes
 * Sin ?branchId: resumen por sucursal (para las tarjetas superiores).
 * Con ?branchId: sobres de una sola semana de esa sucursal. ADMIN
 * puede indicar ?week=YYYY-MM-DD (lunes); los demás roles permanecen
 * en la semana actual. La consulta se filtra en la base de datos.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserWithAnyModuleAccess(["/cash-cuts/safe"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  const { searchParams } = new URL(req.url);
  const requestedBranchId = searchParams.get("branchId");
  const dateRange = user.role === "GERENTE" ? currentBusinessWeekRange() : undefined;

  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
    }
    let week;
    try {
      week = resolveSafeEnvelopeWeek(searchParams.get("week"), user.role);
    } catch (error) {
      if (error instanceof SafeEnvelopeWeekError) {
        return NextResponse.json(
          { error: error.code === "INVALID_WEEK" ? "Semana inválida" : "No tienes acceso a esa semana" },
          { status: error.code === "INVALID_WEEK" ? 400 : 403 },
        );
      }
      throw error;
    }
    const envelopes = await listEnvelopesForBranch(requestedBranchId, week);
    return NextResponse.json({
      envelopes,
      weekStart: week.weekStart,
      currentWeekStart: week.currentWeekStart,
      canNavigateWeeks: week.canNavigateWeeks,
    });
  }

  if (allowedBranchIds && allowedBranchIds.length === 0) {
    return NextResponse.json([]);
  }

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    select: { id: true },
  });

  const summaries = await Promise.all(
    branches.map((b) => getBranchSafeSummary(b.id, dateRange))
  );

  return NextResponse.json(summaries);
}
