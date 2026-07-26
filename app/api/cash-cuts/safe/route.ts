import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_RETIRAR = ["ADMIN", "GERENTE"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");

  const branches = await prisma.branch.findMany({
    where: branchId ? { id: branchId } : undefined,
    select: { id: true, name: true },
  });

  const balances = await Promise.all(
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

      return {
        branchId: branch.id,
        branch: branch.name,
        balance: deposits - withdrawals,
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
      };
    })
  );

  return NextResponse.json(balances);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_QUE_PUEDEN_RETIRAR.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para retirar" }, { status: 403 });
  }

  const body = await req.json();
  const { branchId, amount, notes } = body;

  if (!branchId || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Faltan datos: branchId y amount (mayor a 0)" },
      { status: 400 }
    );
  }

  const movements = await prisma.cashSafeMovement.findMany({ where: { branchId } });
  const deposits = movements
    .filter((m) => m.type === "DEPOSITO_SOBRE")
    .reduce((sum, m) => sum + m.amount, 0);
  const withdrawals = movements
    .filter((m) => m.type === "RETIRO")
    .reduce((sum, m) => sum + m.amount, 0);
  const currentBalance = deposits - withdrawals;

  if (amount > currentBalance) {
    return NextResponse.json(
      { error: `El retiro ($${amount}) excede el saldo disponible ($${currentBalance})` },
      { status: 400 }
    );
  }

  const movement = await prisma.cashSafeMovement.create({
    data: {
      branchId,
      type: "RETIRO",
      amount,
      userId: user.id,
      notes: notes || undefined,
    },
  });

  return NextResponse.json(movement, { status: 201 });
}
