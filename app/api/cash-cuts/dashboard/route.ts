import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithAnyModuleAccess, getAccessibleBranchIds } from "@/lib/auth";
import { addDaysToDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import { getCashCutScope, withCashCutReadScope } from "@/lib/cash-cuts/access";
import { getBranchSafeSummary } from "@/lib/cash-cuts/safeEnvelopes";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserWithAnyModuleAccess(["/cash-cuts/dashboard"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const scope = await getCashCutScope(["/cash-cuts/dashboard"]);
  if (!scope) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

  const defaultFrom = parseDateOnly(addDaysToDateOnly(todayDateOnly(), -7));

  const dateFrom = searchParams.get("dateFrom")
    ? parseDateOnly(searchParams.get("dateFrom")!)
    : defaultFrom;
  const dateTo = searchParams.get("dateTo")
    ? parseDateOnly(searchParams.get("dateTo")!)
    : new Date();

  const cuts = await prisma.cashCut.findMany({
    where: withCashCutReadScope(scope, {
      status: "CERRADO",
      date: { gte: dateFrom, lte: dateTo },
      ...(branchFilter ? { branchId: branchFilter } : {}),
    }),
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
      active: true,
      ...(branchFilter ? { id: branchFilter } : {}),
    },
    select: { id: true, name: true },
  });

  const safeBalances = await Promise.all(
    branches.map(async (branch) => {
      const summary = await getBranchSafeSummary(branch.id);
      return { branch: branch.name, balance: summary.balance };
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
