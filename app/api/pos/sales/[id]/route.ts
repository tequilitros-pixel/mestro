import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const sale = await prisma.posSale.findUnique({
    where: { id },
    include: {
      branch: true,
      soldBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      items: true,
      payments: true,
      cashCut: { select: { id: true, code: true } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: sale.branchId },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  return NextResponse.json(sale);
}
