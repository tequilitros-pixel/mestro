import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_ABRIR_CORTE = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // GERENTE y ENCARGADO solo ven sus sucursales asignadas.
  let allowedBranchIds: string[] | undefined;
  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const userBranches = await prisma.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    });
    allowedBranchIds = userBranches.map((b) => b.branchId);
  }

  const cashCuts = await prisma.cashCut.findMany({
    where: {
      branchId: branchId ?? (allowedBranchIds ? { in: allowedBranchIds } : undefined),
      status: status as never,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    include: {
      branch: true,
      responsible: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(cashCuts);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_ABRIR_CORTE.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para abrir un corte" }, { status: 403 });
  }

  const body = await request.json();
  const { branchId, date, startingFund, responsibleId } = body;

  if (!branchId || !date || startingFund === undefined) {
    return NextResponse.json({ error: "Faltan datos: branchId, date, startingFund" }, { status: 400 });
  }

  // Código legible: CC-<CODIGO_SUCURSAL>-<FECHA>-<consecutivo del día>
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const dayCount = await prisma.cashCut.count({
    where: { branchId, date: new Date(date) },
  });
  const code = `CC-${branch.code}-${date}-${String(dayCount + 1).padStart(2, "0")}`;

  const cashCut = await prisma.cashCut.create({
    data: {
      code,
      branchId,
      date: new Date(date),
      startingFund,
      responsibleId: responsibleId ?? user.id,
      createdById: user.id,
      status: "ABIERTO",
      auditEntries: {
        create: {
          action: "CREADO",
          userId: user.id,
        },
      },
    },
  });

  return NextResponse.json(cashCut, { status: 201 });
}
