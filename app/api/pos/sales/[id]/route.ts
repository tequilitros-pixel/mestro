import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithAnyModuleAccess } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { getCurrentPospressCashCut } from "@/lib/pos/currentCashCut";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserWithAnyModuleAccess(["/pos", "/pos/sales"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const currentCashCut = user.role === "ADMIN" ? null : await getCurrentPospressCashCut(user);
  if (user.role !== "ADMIN" && !currentCashCut) {
    return NextResponse.json({ error: "No tienes un corte de caja abierto asignado." }, { status: 403 });
  }

  const sale = await withRlsContext(user, (tx) => tx.posSale.findUnique({
    where: { id },
    include: {
      branch: true,
      soldBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      items: true,
      payments: true,
      cashCut: { select: { id: true, code: true } },
    },
  }));

  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  if (currentCashCut && (sale.branchId !== currentCashCut.branch.id || sale.cashCutId !== currentCashCut.id)) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  if (user.role !== "ADMIN") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: sale.branchId },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  return NextResponse.json(sale);
}
