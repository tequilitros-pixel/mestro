"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser, requireModuleActionAccess } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";
import { parseDateOnly } from "@/lib/dateOnly";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { reconcileWeeklyCountCutover } from "@/lib/inventory/weeklyCountCutover";

const INVENTORY_COUNTS_PERMISSION = "/administration/inventory/branch-counts";

async function authorizeCountBranch(branchId: string) {
  await requireModuleActionAccess(INVENTORY_COUNTS_PERMISSION);
  const allowedBranchIds = await getAccessibleBranchIds();
  if (!isBranchAllowed(allowedBranchIds, branchId)) throw new Error("PERMISSION_DENIED");
}

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
    await authorizeCountBranch(branchId);

    if (!countDateRaw) {
      return { success: false, error: "La fecha del conteo es obligatoria." };
    }

    let countDate: Date;
    try {
      countDate = parseDateOnly(countDateRaw);
    } catch {
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
    const scopedItem = await prisma.inventoryCountItem.findUnique({
      where: { id: itemId },
      select: { countId: true, count: { select: { branchId: true } } },
    });
    if (!scopedItem || scopedItem.countId !== countId) throw new Error("PERMISSION_DENIED");
    await authorizeCountBranch(scopedItem.count.branchId);
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
  operationId: string,
): Promise<ActionResult> {
  try {
    const scopedCount = await prisma.inventoryCount.findUnique({ where: { id: countId }, select: { branchId: true } });
    if (!scopedCount) return { success: false, error: "Conteo no encontrado." };
    await authorizeCountBranch(scopedCount.branchId);
    const actor = await getCurrentUser();
    if (!actor) return { success: false, error: "Sesión no válida." };
    await executeIdempotent({
      operationId,
      command: "CloseInventoryCountV2",
      payload: { countId },
      receiptContext: { actorId: actor.id, branchId: scopedCount.branchId },
      execute: async (tx) => {
        return reconcileWeeklyCountCutover(tx, { countId, actorId: actor.id, operationId });
      },
    });

    revalidatePath(`/administration/inventory/branch-counts/${countId}`);
    revalidatePath("/administration/inventory/branch-counts");

    return { success: true, message: "Conteo cerrado y consumo calculado." };
  } catch (error) {
    console.error("Error closing inventory count:", error);
    return { success: false, error: "No fue posible cerrar el conteo." };
  }
}
