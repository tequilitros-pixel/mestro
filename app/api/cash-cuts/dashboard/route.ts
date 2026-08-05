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

  let branchFilter: string | { in: string[] } | undefined;

  if (requestedBranchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
      return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
    }
    branchFilter = requestedBranchId;
  } else if (allowedBranchIds) {
    if (allowedBranchIds.length === 0) {
      // Usuario sin sucursales asignadas: no ve nada.
      return NextResponse.json({
        period: { from: null, to: null },
        totalSales: 0,
        totalDifference: 0,
        cortesConDiferencia: 0,
        totalSafeBalance: 0,
        salesByBranch: [],
        safeBalances: [],
        recentCuts: [],
      });
    }
    branchFilter = { in: allowedBranchIds };
  }

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  const dateFrom = searchParams.get("dateFrom")
    ? new Date(searchParams.get("dateFrom")!)
    : defaultFrom;
  const dateTo = searchParams.get("dateTo")
    ? new Date(searchParams.get("dateTo")!)
    : new Date();

  const cuts = await prisma.cashCut.findMany({
    where: {
      status: "CERRADO",
      date: { gte: dateFrom, lte: dateTo },
      ...(branchFilter ? { branchId: branchFilter } : {}),
    },
    include: { branch: true },
    orderBy: { date: "desc" },
  });

  const totalSales = cuts.reduce((sum, c) => sum + (c.totalSales ?? 0), 0);
  const totalDifference = cuts.reduce((sum, c) => sum + (c.difference ?? 0), 0);
  const cortesConDiferencia = cuts.filter(
    (c) => Math.abs(c.difference ?? 0) > 10
  ).length;

  const byBranchMap = new Map<
    string,
    { branch: string; totalSales: number; totalDifference: number; count: number }
  >();

  for (const cut of cuts) {
    const key = cut.branchId;
    const entry = byBranchMap.get(key) ?? {
      branch: cut.branch.name,
      totalSales: 0,
      totalDifference: 0,
      count: 0,
    };
    entry.totalSales += cut.totalSales ?? 0;
    entry.totalDifference += cut.difference ?? 0;
    entry.count += 1;
    byBranchMap.set(key, entry);
  }

  const salesByBranch = Array.from(byBranchMap.values()).sort(
    (a, b) => b.totalSales - a.totalSales
  );

  const branches = await prisma.branch.findMany({
    where: {
      ...(requestedBranchId ? { id: requestedBranchId } : {}),
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    select: { id: true, name: true },
  });

  const safeBalances = await Promise.all(
    branches.map(async (branch) => {
      const movements = await prisma.cashSafeMovement.findMany({
        where: { branchId: branch.id },
      });
      const deposits = movements
        .filter((m) => m.type === "DEPOSITO_SOBRE")
        .reduce((sum, m) => sum + m.amount, 0);
      const withdrawals = movements
        .filter((m) => m.type === "RETIRO")
        .reduce((sum, m) => sum + m.amount, 0);
      return { branch: branch.name, balance: deposits - withdrawals };
    })
  );

  const totalSafeBalance = safeBalances.reduce((sum, b) => sum + b.balance, 0);

  const recentCuts = cuts.slice(0, 15).map((c) => ({
    id: c.id,
    code: c.code,
    branch: c.branch.name,
    date: c.date,
    totalSales: c.totalSales,
    difference: c.difference,
  }));

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    totalSales,
    totalDifference,
    cortesConDiferencia,
    totalSafeBalance,
    salesByBranch,
    safeBalances,
    recentCuts,
  });
}
