"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser, requireModuleActionAccess } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";
import { parseDateOnly } from "@/lib/dateOnly";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { reconcileWeeklyCountCutover } from "@/lib/inventory/weeklyCountCutover";
import {
  normalizeInventoryCountCapture,
} from "@/lib/inventory/countCapture";
import type { InventoryCaptureUnit } from "@/lib/inventory/units";
import {
  isInventoryCountType,
  isProductIncludedInInventoryCount,
  inventoryCountTypeLabel,
} from "@/lib/inventory/countScope";

const INVENTORY_COUNTS_PERMISSION = "/administration/inventory/branch-counts";

async function authorizeCountBranch(branchId: string) {
  await requireModuleActionAccess(INVENTORY_COUNTS_PERMISSION);
  const allowedBranchIds = await getAccessibleBranchIds();
  if (!isBranchAllowed(allowedBranchIds, branchId)) throw new Error("PERMISSION_DENIED");
}

export type ActionResult =
  | {
      success: true;
      message: string;
      id?: string;
      baseQuantity?: string;
      captureUnit?: InventoryCaptureUnit;
    }
  | { success: false; error: string };

export async function createInventoryCountAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const branchId = formData.get("branchId")?.toString() ?? "";
    const countDateRaw = formData.get("countDate")?.toString() ?? "";
    const countTypeRaw = formData.get("countType")?.toString() ?? "WEEKLY";

    if (!branchId) {
      return { success: false, error: "Selecciona una sucursal." };
    }
    if (!isInventoryCountType(countTypeRaw)) {
      return { success: false, error: "Selecciona un tipo de conteo válido." };
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
      where: { branchId, status: "BORRADOR", countType: countTypeRaw },
      select: { id: true },
    });

    if (openCount) {
      return {
        success: false,
        error: "Ya existe un conteo abierto para esta sucursal. Ciérralo antes de crear uno nuevo.",
      };
    }

    const previousCount = await prisma.inventoryCount.findFirst({
      where: { branchId, status: "CERRADO", countType: countTypeRaw },
      orderBy: { countDate: "desc" },
      include: { items: true },
    });

    const products = (await prisma.inventoryProduct.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        trackStock: true,
        ...(countTypeRaw === "WEEKLY" ? { countFrequency: "WEEKLY" } : {}),
      },
      orderBy: { name: "asc" },
    })).filter((product) =>
      isProductIncludedInInventoryCount(product, countTypeRaw),
    );

    const code = `CNT-${Date.now()}`;

    const count = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCount.create({
        data: { code, branchId, countDate, countType: countTypeRaw, status: "BORRADOR" },
        select: { id: true },
      });

      for (const product of products) {
        const previousItem = previousCount?.items.find(
          (i) => i.productId === product.id,
        );
        const previousQuantity = previousItem?.quantityCounted ?? 0;

        await tx.inventoryCountItem.create({
          data: {
            countId: created.id,
            productId: product.id,
            quantityCounted: null,
            countedAt: null,
            previousQuantity,
          },
        });
      }

      return created;
    });

    revalidatePath("/administration/inventory/branch-counts");

    return {
      success: true,
      message: `${inventoryCountTypeLabel(countTypeRaw)} creado.`,
      id: count.id,
    };
  } catch (error) {
    console.error("Error creating inventory count:", error);
    return { success: false, error: "No fue posible crear el conteo." };
  }
}

export async function updateCountItemQuantityAction(
  input: {
    itemId: string;
    countId: string;
    quantity: string;
    captureUnit: InventoryCaptureUnit;
  },
): Promise<ActionResult> {
  try {
    const scopedItem = await prisma.inventoryCountItem.findUnique({
      where: { id: input.itemId },
      select: { countId: true, count: { select: { branchId: true } } },
    });
    if (!scopedItem || scopedItem.countId !== input.countId) throw new Error("PERMISSION_DENIED");
    await authorizeCountBranch(scopedItem.count.branchId);

    const result = await prisma.$transaction(async (tx) => {
      const lockedCount = await tx.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id", "status"::text FROM "InventoryCount" WHERE "id"=${input.countId} FOR UPDATE`;
      if (!lockedCount[0]) throw new Error("COUNT_NOT_FOUND");
      if (lockedCount[0].status !== "BORRADOR") throw new Error("COUNT_ALREADY_CLOSED");

      const item = await tx.inventoryCountItem.findUnique({
        where: { id: input.itemId },
        include: { product: true },
      });
      if (!item || item.countId !== input.countId) throw new Error("PERMISSION_DENIED");

      const normalized = normalizeInventoryCountCapture({
        quantity: input.quantity,
        captureUnit: input.captureUnit,
        product: item.product,
      });

      await tx.inventoryCountItem.update({
        where: { id: item.id },
        data: { quantityCounted: normalized.baseQuantity, countedAt: new Date() },
      });

      return normalized;
    });

    revalidatePath(`/administration/inventory/branch-counts/${input.countId}`);

    return {
      success: true,
      message: "Cantidad guardada.",
      baseQuantity: result.baseQuantity.toFixed(3),
      captureUnit: result.captureUnit,
    };
  } catch (error) {
    console.error("Error updating count item:", error);
    if (error instanceof Error && error.message === "COUNT_ALREADY_CLOSED") {
      return { success: false, error: "Este conteo ya está cerrado." };
    }
    if (error instanceof Error && error.message === "COUNT_QUANTITY_REQUIRED") {
      return { success: false, error: "Captura una cantidad antes de guardar." };
    }
    if (error instanceof Error && error.message === "COUNT_QUANTITY_PRECISION") {
      return { success: false, error: "La cantidad admite hasta 3 decimales." };
    }
    if (error instanceof Error && error.message === "PRESENTATION_NOT_CONFIGURED") {
      return { success: false, error: "La presentación comercial no está configurada." };
    }
    if (error instanceof Error && ["COUNT_QUANTITY_INVALID", "COUNT_CAPTURE_UNIT_INVALID"].includes(error.message)) {
      return { success: false, error: "La cantidad o unidad de captura no es válida." };
    }
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
    if (error instanceof Error && error.message === "COUNT_ALREADY_CLOSED") {
      return { success: false, error: "Este conteo ya está cerrado." };
    }
    const pendingMatch = error instanceof Error
      ? /^COUNT_ITEMS_PENDING:(\d+)$/.exec(error.message)
      : null;
    if (pendingMatch) {
      const pendingCount = Number(pendingMatch[1]);
      return {
        success: false,
        error: `Faltan ${pendingCount} productos por contar. Captura cada producto antes de cerrar.`,
      };
    }
    return { success: false, error: "No fue posible cerrar el conteo." };
  }
}
