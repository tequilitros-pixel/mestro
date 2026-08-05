import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_CANCELAR = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_CANCELAR.includes(user.role)) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar ventas" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const sale = await prisma.posSale.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          variant: { include: { ingredients: true } },
        },
      },
      payments: true,
      cashCut: { select: { id: true, status: true } },
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

  if (sale.status === "CANCELADA") {
    return NextResponse.json({ error: "Esta venta ya está cancelada." }, { status: 400 });
  }

  const cashCutStillOpen = sale.cashCut.status === "ABIERTO";

  if (!cashCutStillOpen && user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error:
          "El corte de caja de esta venta ya está cerrado. Solo un administrador puede cancelarla.",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const cancelReason = typeof body?.reason === "string" ? body.reason.trim() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.posSale.update({
      where: { id: sale.id },
      data: {
        status: "CANCELADA",
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancelReason: cancelReason || null,
      },
      include: { items: true, payments: true },
    });

    // Regresa al inventario los ingredientes consumidos por esta venta.
    for (const item of sale.items) {
      if (!item.variant) continue;

      for (const ingredient of item.variant.ingredients) {
        await tx.inventoryEntry.create({
          data: {
            branchId: sale.branchId,
            productId: ingredient.inventoryProductId,
            type: "DEVOLUCION_POS",
            quantity: Number(ingredient.quantity) * item.quantity,
            notes: `Cancelación de venta POS ${sale.code}`,
          },
        });
      }
    }

    // Si el corte sigue abierto, resta lo cobrado del total por
    // método de pago; si ya cerró, el total del corte queda como
    // se cerró y solo se corrige el registro de la venta.
    if (cashCutStillOpen) {
      for (const payment of sale.payments) {
        await tx.cashSalePayment.updateMany({
          where: { cashCutId: sale.cashCutId, method: payment.method },
          data: { amount: { decrement: payment.amount } },
        });
      }
    }

    return cancelled;
  });

  return NextResponse.json(updated);
}
