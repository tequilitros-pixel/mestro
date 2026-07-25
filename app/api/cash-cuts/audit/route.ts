import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cashCutId = searchParams.get("cashCutId");
  const branchId = searchParams.get("branchId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const entries = await prisma.cashCutAuditEntry.findMany({
    where: {
      ...(cashCutId ? { cashCutId } : {}),
      ...(branchId ? { cashCut: { branchId } } : {}),
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
      cashCutCode: e.cashCut.code,
      branch: e.cashCut.branch.name,
      action: e.action,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      user: e.user.name,
      createdAt: e.createdAt,
    }))
  );
}
