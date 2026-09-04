import "server-only";
import { prisma } from "@/lib/prisma";
import { setRlsContext } from "@/lib/rls";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { evaluateCapabilityShadow } from "@/lib/pos2/capabilities";

export async function cancelPosSaleAtomic(input: {
  saleId: string;
  user: { id: string; role: string };
  reason: string | null;
  operationId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, input.user);
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PosSale" WHERE "id" = ${input.saleId} FOR UPDATE
    `;
    if (!locked[0]) return { kind: "not_found" as const };

    const sale = await tx.posSale.findUnique({
      where: { id: input.saleId },
      include: {
        items: { include: { variant: { include: { ingredients: true } } } },
        payments: true,
        cashCut: { select: { id: true, status: true } },
      },
    });
    if (!sale) return { kind: "not_found" as const };
    if (sale.status === "CANCELADA") return { kind: "duplicate" as const, sale };
    if (sale.cashCut.status !== "ABIERTO" && input.user.role !== "ADMIN") {
      return { kind: "closed_cut" as const };
    }

    const cancelled = await tx.posSale.update({
      where: { id: sale.id },
      data: { status: "CANCELADA", cancelledAt: new Date(), cancelledById: input.user.id, cancelReason: input.reason },
      include: { items: true, payments: true },
    });

    const reversals = sale.items.flatMap((item) =>
      item.variant
        ? item.variant.ingredients.map((ingredient) => ({
            branchId: sale.branchId,
            productId: ingredient.inventoryProductId,
            type: "DEVOLUCION_POS" as const,
            quantity: Number(ingredient.quantity) * item.quantity,
            notes: `Cancelación de venta POS ${sale.code}`,
          }))
        : [],
    );
    if (reversals.length) await tx.inventoryEntry.createMany({ data: reversals });

    if (sale.cashCut.status === "ABIERTO") {
      for (const payment of sale.payments) {
        await tx.cashSalePayment.updateMany({
          where: { cashCutId: sale.cashCutId, method: payment.method },
          data: { amount: { decrement: payment.amount } },
        });
      }
    }

    await appendAuditEvent(tx, {
      actorId: input.user.id, branchId: sale.branchId, action: "pos.sale.cancelled",
      entityType: "PosSale", entityId: sale.id, operationId: input.operationId,
      metadata: { code: sale.code, cashCutOpen: sale.cashCut.status === "ABIERTO", reasonProvided: Boolean(input.reason) },
    });
    await evaluateCapabilityShadow(tx, {
      actor: { id: input.user.id, role: input.user.role as "ADMIN" | "GERENTE" | "ENCARGADO" | "OPERATOR" | "CONSULTA", branchIds: input.user.role === "ADMIN" ? null : [sale.branchId] },
      capability: "pos.sale.cancel", branchId: sale.branchId, legacyAllowed: true,
      entityType: "PosSale", entityId: sale.id,
    });
    await appendOutboxEvent(tx, {
      topic: "pos.sale.cancelled", aggregate: "PosSale", aggregateId: sale.id,
      operationId: input.operationId, payload: { saleId: sale.id, branchId: sale.branchId, code: sale.code },
    });
    return { kind: "cancelled" as const, sale: cancelled };
  });
}
