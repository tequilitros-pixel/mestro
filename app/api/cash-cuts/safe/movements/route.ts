import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { addDaysToDateOnly, businessDayStart } from "@/lib/dateOnly";

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
  const rangeStart = dateFrom ? businessDayStart(dateFrom) : undefined;
  const rangeEnd = dateTo ? businessDayStart(addDaysToDateOnly(dateTo, 1)) : undefined;

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

  const movements = await prisma.cashSafeMovement.findMany({
    where: {
      ...(branchFilter ? { branchId: branchFilter } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              gte: rangeStart,
              lt: rangeEnd,
            },
          }
        : {}),
    },
    include: { branch: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    movements.map((m) => ({
      id: m.id,
      branch: m.branch.name,
      type: m.type,
      amount: m.amount,
      notes: m.notes,
      user: m.user.name,
      createdAt: m.createdAt,
    })),
  );
}
