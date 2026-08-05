import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();

  const { searchParams } = new URL(req.url);
  const cashCutId = searchParams.get("cashCutId");
  const requestedBranchId = searchParams.get("branchId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Si el usuario tiene sucursales restringidas y pidió una específica,
  // solo se respeta si está dentro de lo que puede ver.
  let branchFilter: string | { in: string[] } | undefined;

  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      return NextResponse.json([]);
    }
    branchFilter = requestedBranchId;
  } else if (allowedBranchIds) {
    branchFilter = { in: allowedBranchIds };
  }

  const entries = await prisma.cashCutAuditEntry.findMany({
    where: {
      ...(cashCutId ? { cashCutId } : {}),
      ...(branchFilter ? { cashCut: { branchId: branchFilter } } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
            },
          }
        : {}),
    },
    include: {
      cashCut: { include: { branch: true } },
      user: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      cashCutId: e.cashCutId,
      cashCutCode: e.cashCut.code,
      branch: e.cashCut.branch.name,
      action: e.action,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      user: e.user.name,
      createdAt: e.createdAt,
    })),
  );
}
