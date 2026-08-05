"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

export async function createInventoryCountAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const branchId = formData.get("branchId")?.toString() ?? "";
    const countDateRaw = formData.get("countDate")?.toString() ?? "";

    if (!branchId) {
      return { success: false, error: "Selecciona una sucursal." };
    }

    if (!countDateRaw) {
      return { success: false, error: "La fecha del conteo es obligatoria." };
    }

    const countDate = new Date(countDateRaw);

    if (Number.isNaN(countDate.getTime())) {
      return { success: false, error: "La fecha no es válida." };
    }

    const openCount = await prisma.inventoryCount.findFirst({
      where: { branchId, status: "BORRADOR" },
      select: { id: true },
    });

    if (openCount) {
      return {
        success: false,
        error: "Ya existe un conteo abierto para esta sucursal. Ciérralo antes de crear uno nuevo.",
      };
    }

    const previousCount = await prisma.inventoryCount.findFirst({
      where: { branchId, status: "CERRADO" },
      orderBy: { countDate: "desc" },
      include: { items: true },
    });

    const products = await prisma.inventoryProduct.findMany({
      where: { isActive: true, trackStock: true },
      orderBy: { name: "asc" },
    });

    const code = `CNT-${Date.now()}`;

    const count = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCount.create({
        data: { code, branchId, countDate, status: "BORRADOR" },
        select: { id: true },
      });

      for (const product of products) {
        const previousItem = previousCount?.items.find(
          (i) => i.productId === product.id,
        );
        const previousQuantity = previousItem ? previousItem.quantityCounted : 0;

        await tx.inventoryCountItem.create({
          data: {
            countId: created.id,
            productId: product.id,
            quantityCounted: 0,
            previousQuantity,
          },
        });
      }

      return created;
    });

    revalidatePath("/administration/inventory/branch-counts");

    return { success: true, message: "Conteo creado.", id: count.id };
  } catch (error) {
    console.error("Error creating inventory count:", error);
    return { success: false, error: "No fue posible crear el conteo." };
  }
}

export async function updateCountItemQuantityAction(
  itemId: string,
  countId: string,
  quantityCounted: number,
): Promise<ActionResult> {
  try {
    if (quantityCounted < 0) {
      return { success: false, error: "La cantidad no puede ser negativa." };
    }

    await prisma.inventoryCountItem.update({
      where: { id: itemId },
      data: { quantityCounted },
    });

    revalidatePath(`/administration/inventory/branch-counts/${countId}`);

    return { success: true, message: "Cantidad guardada." };
  } catch (error) {
    console.error("Error updating count item:", error);
    return { success: false, error: "No fue posible guardar la cantidad." };
  }
}

export async function closeInventoryCountAction(
  countId: string,
): Promise<ActionResult> {
  try {
    const count = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { items: { include: { product: true } } },
    });

    if (!count) {
      return { success: false, error: "Conteo no encontrado." };
    }

    if (count.status === "CERRADO") {
      return { success: false, error: "Este conteo ya está cerrado." };
    }

    const previousCount = await prisma.inventoryCount.findFirst({
      where: {
        branchId: count.branchId,
        status: "CERRADO",
        countDate: { lt: count.countDate },
      },
      orderBy: { countDate: "desc" },
      select: { countDate: true },
    });

    const periodStart = previousCount?.countDate ?? new Date(0);

    await prisma.$transaction(async (tx) => {
      for (const item of count.items) {
        const entries = await tx.inventoryEntry.aggregate({
          where: {
            branchId: count.branchId,
            productId: item.productId,
            entryDate: { gt: periodStart, lte: count.countDate },
          },
          _sum: { quantity: true },
        });

        const entriesQuantity = entries._sum.quantity
          ? Number(entries._sum.quantity)
          : 0;
        const previous = Number(item.previousQuantity ?? 0);
        const counted = Number(item.quantityCounted);
        const consumed = Math.max(previous + entriesQuantity - counted, 0);
        const unitCost =
          item.product.unitCost !== null ? Number(item.product.unitCost) : null;
        const costTotal = unitCost !== null ? consumed * unitCost : null;

        await tx.inventoryCountItem.update({
          where: { id: item.id },
          data: {
            entriesQuantity,
            quantityConsumed: consumed,
            unitCostAtTime: unitCost,
            costTotal,
          },
        });
      }

      await tx.inventoryCount.update({
        where: { id: countId },
        data: { status: "CERRADO" },
      });
    });

    revalidatePath(`/administration/inventory/branch-counts/${countId}`);
    revalidatePath("/administration/inventory/branch-counts");

    return { success: true, message: "Conteo cerrado y consumo calculado." };
  } catch (error) {
    console.error("Error closing inventory count:", error);
    return { success: false, error: "No fue posible cerrar el conteo." };
  }
}
