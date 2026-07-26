import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const movements = await prisma.cashSafeMovement.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
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
    }))
  );
}
