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
  const requestedBranchId = searchParams.get("branchId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  let branchFilter: string | { in: string[] } | undefined;

  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      return NextResponse.json([]);
    }
    branchFilter = requestedBranchId;
  } else if (allowedBranchIds) {
    if (allowedBranchIds.length === 0) {
      return NextResponse.json([]);
    }
    branchFilter = { in: allowedBranchIds };
  }

  const cuts = await prisma.cashCut.findMany({
    where: {
      status: "CERRADO",
      ...(branchFilter ? { branchId: branchFilter } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
            },
          }
        : {}),
      envelopeAmount: { gt: 0 },
    },
    include: { branch: true, responsible: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    cuts.map((c) => ({
      id: c.id,
      branch: c.branch.name,
      date: c.date,
      envelopeAmount: c.envelopeAmount,
      envelopeNumber: c.envelopeNumber,
      envelopeNotes: c.envelopeNotes,
      responsible: c.responsible?.name,
    })),
  );
}
