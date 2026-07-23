import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // GERENTE/ENCARGADO solo ven salidas de sus sucursales asignadas.
  let allowedBranchIds: string[] | undefined;
  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const userBranches = await prisma.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    });
    allowedBranchIds = userBranches.map((b) => b.branchId);
  }

  const outflows = await prisma.cashOutflow.findMany({
    where: {
      category: category ?? undefined,
      occurredAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
      cashCut: {
        branchId: branchId ?? (allowedBranchIds ? { in: allowedBranchIds } : undefined),
      },
    },
    include: {
      cashCut: {
        select: { code: true, branch: { select: { name: true } } },
      },
    },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json(outflows);
}
