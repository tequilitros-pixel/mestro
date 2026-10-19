"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, requireAdminAction, requireInventoryCountCaptureActionAccess } from "@/lib/auth";
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

async function authorizeCountBranch(branchId: string) {
  const user = await requireInventoryCountCaptureActionAccess();
  const allowedBranchIds = await getAccessibleBranchIds();
  if (!isBranchAllowed(allowedBranchIds, branchId)) throw new Error("PERMISSION_DENIED");
  return user;
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
    const currentUser = await authorizeCountBranch(branchId);

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
        data: { code, branchId, countDate, countType: countTypeRaw, status: "BORRADOR", createdById: currentUser.id },
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

export async function addInventoryCountProductAction(
  countId: string,
  productId: string,
): Promise<ActionResult> {
  try {
    if (!countId || !productId) {
      return { success: false, error: "Selecciona un producto válido." };
    }

    const scope = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      select: { branchId: true },
    });
    if (!scope) return { success: false, error: "Conteo no encontrado." };
    await authorizeCountBranch(scope.branchId);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id", "status"::text FROM "InventoryCount" WHERE "id"=${countId} FOR UPDATE`;
      if (!locked[0]) throw new Error("COUNT_NOT_FOUND");
      if (locked[0].status !== "BORRADOR") throw new Error("COUNT_ALREADY_CLOSED");

      const count = await tx.inventoryCount.findUnique({
        where: { id: countId },
        select: { branchId: true, countType: true },
      });
      if (!count || count.branchId !== scope.branchId) throw new Error("COUNT_NOT_FOUND");

      const product = await tx.inventoryProduct.findUnique({ where: { id: productId } });
      if (!product || !isProductIncludedInInventoryCount(product, count.countType)) {
        throw new Error("PRODUCT_NOT_COUNTABLE");
      }

      const existing = await tx.inventoryCountItem.findUnique({
        where: { countId_productId: { countId, productId } },
        select: { id: true },
      });
      if (existing) return "already-added" as const;

      const previousCount = await tx.inventoryCount.findFirst({
        where: { branchId: count.branchId, status: "CERRADO", countType: count.countType },
        orderBy: { countDate: "desc" },
        select: { items: { where: { productId }, select: { quantityCounted: true } } },
      });
      await tx.inventoryCountItem.create({
        data: {
          countId,
          productId,
          quantityCounted: null,
          countedAt: null,
          previousQuantity: previousCount?.items[0]?.quantityCounted ?? 0,
        },
      });
      return "added" as const;
    });

    revalidatePath(`/administration/inventory/branch-counts/${countId}`);
    return {
      success: true,
      message: result === "added" ? "Producto agregado al conteo; falta capturar su cantidad." : "El producto ya está en el conteo.",
    };
  } catch (error) {
    console.error("Error adding product to inventory count:", error);
    if (error instanceof Error && error.message === "COUNT_ALREADY_CLOSED") {
      return { success: false, error: "Este conteo ya está cerrado." };
    }
    if (error instanceof Error && error.message === "PRODUCT_NOT_COUNTABLE") {
      return { success: false, error: "El producto ya no pertenece al alcance de este conteo." };
    }
    return { success: false, error: "No fue posible agregar el producto al conteo." };
  }
}

export async function updateCountItemQuantityAction(
  input: {
    itemId: string;
    countId: string;
    quantity: string;
    loosePieces?: string;
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
        loosePieces: input.loosePieces,
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
    if (error instanceof Error && error.message === "COUNT_PACKAGES_WHOLE") {
      return { success: false, error: "Los paquetes completos deben ser un número entero." };
    }
    if (error instanceof Error && error.message === "COUNT_LOOSE_PIECES_WHOLE") {
      return { success: false, error: "Las piezas sueltas deben ser un número entero." };
    }
    if (error instanceof Error && error.message === "COUNT_LOOSE_PIECES_LIMIT") {
      return { success: false, error: "Las piezas sueltas deben ser menores a las que contiene un paquete." };
    }
    if (error instanceof Error && error.message === "COUNT_LOOSE_PIECES_NOT_ALLOWED") {
      return { success: false, error: "Este producto no está configurado como paquete de piezas." };
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
    const actor = await requireAdminAction();
    const scopedCount = await prisma.inventoryCount.findUnique({ where: { id: countId }, select: { branchId: true } });
    if (!scopedCount) return { success: false, error: "Conteo no encontrado." };
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
    const missingProductsMatch = error instanceof Error
      ? /^COUNT_PRODUCTS_MISSING:(\d+)$/.exec(error.message)
      : null;
    if (missingProductsMatch) {
      return {
        success: false,
        error: `Faltan ${missingProductsMatch[1]} productos en el conteo. Agrégalos y captura su cantidad antes de cerrar.`,
      };
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
