"use server";

import { revalidatePath } from "next/cache";
import { recordManualInventoryMovement } from "@/lib/inventory/manualMovements";
import { prisma } from "@/lib/prisma";
import { InventoryEntryType } from "@prisma/client";
import { getAccessibleBranchIds, getCurrentUser, requireModuleActionAccess } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";
import { generateOperationId } from "@/lib/pos2/operationId";
import {
  recordWeeklyInventoryReceiptBatch,
  type WeeklyInventoryReceiptItem,
} from "@/lib/inventory/manualMovements";
import type { InventoryCaptureUnit } from "@/lib/inventory/units";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

function readOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value.toString().trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function createInventoryEntryAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireModuleActionAccess("/administration/inventory/branch-entries");
    const branchId = formData.get("branchId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const typeValue = formData.get("type")?.toString() ?? "";
    const direction = formData.get("direction")?.toString() ?? "SUMA";
    const quantity = readOptionalNumber(formData.get("quantity"));
    const unitCost = readOptionalNumber(formData.get("unitCost"));
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!branchId || !productId) {
      return { success: false, error: "Selecciona sucursal y producto." };
    }

    const [user, allowedBranchIds] = await Promise.all([
      getCurrentUser(),
      getAccessibleBranchIds(),
    ]);

    if (!user) {
      return { success: false, error: "Tu sesión terminó. Vuelve a iniciar sesión." };
    }

    if (!isBranchAllowed(allowedBranchIds, branchId)) {
      return {
        success: false,
        error: "No tienes permiso para registrar movimientos en esa sucursal.",
      };
    }

    if (quantity === null || quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    if (!["COMPRA", "AJUSTE", "TRASPASO"].includes(typeValue)) {
      return { success: false, error: "Selecciona un tipo de entrada válido." };
    }

    if (typeValue === "TRASPASO") {
      return {
        success: false,
        error: "Usa Traspasos para mover stock entre sucursales.",
      };
    }

    const product = await prisma.inventoryProduct.findFirst({
      where: { id: productId, isActive: true, archivedAt: null, trackStock: true },
      select: { id: true },
    });
    if (!product) {
      return {
        success: false,
        error: "No se puede registrar movimiento para un producto inactivo, archivado o no inventariable.",
      };
    }

    const signedQuantity =
      typeValue === "AJUSTE" && direction === "RESTA" ? -quantity : quantity;

    if (formData.get("unitCost")?.toString().trim() && unitCost === null) return { success: false, error: "El costo debe ser un número válido." };
    if (typeValue === "AJUSTE" && !["SUMA", "RESTA"].includes(direction)) return { success: false, error: "Selecciona el sentido del ajuste." };
    if (unitCost !== null && unitCost < 0) return { success: false, error: "El costo no puede ser negativo." };
    const outcome = await recordManualInventoryMovement({
      actorId: user.id, operationId: formData.get("operationId")?.toString(),
      branchId, productId, type: typeValue as InventoryEntryType,
      quantity: signedQuantity, unitCost, notes,
    });

    revalidatePath("/administration/inventory/branch-entries");
    revalidatePath("/administration/inventory/sucursales/stock");

    return { success: true, message: "Entrada registrada correctamente.", id: String(outcome.result.id) };
  } catch (error) {
    console.error("Error creating inventory entry:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible registrar la entrada." };
  }
}

function parseWeeklyReceiptItems(value: FormDataEntryValue | null): WeeklyInventoryReceiptItem[] | null {
  if (typeof value !== "string" || value.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 500) return null;

  const items: WeeklyInventoryReceiptItem[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId.trim() : "";
    const quantity = typeof row.quantity === "string" ? row.quantity.trim() : "";
    const loosePieces = typeof row.loosePieces === "string" ? row.loosePieces.trim() : undefined;
    const captureUnit = row.captureUnit;
    if (!productId || !quantity || (captureUnit !== "BASE" && captureUnit !== "PRESENTATION")) return null;
    if (loosePieces !== undefined && loosePieces === "") return null;
    items.push({
      productId,
      quantity,
      loosePieces,
      captureUnit: captureUnit as InventoryCaptureUnit,
    });
  }
  return items;
}

export async function createWeeklyInventoryReceiptAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireModuleActionAccess("/administration/inventory/branch-entries");
    const branchId = formData.get("branchId")?.toString() ?? "";
    const notes = formData.get("notes")?.toString().trim() || null;
    const operationId = formData.get("operationId")?.toString() || generateOperationId();
    const items = parseWeeklyReceiptItems(formData.get("items"));

    if (!branchId) return { success: false, error: "Selecciona una sucursal." };
    if (items === null) return { success: false, error: "La captura semanal no tiene un formato válido." };
    if (items.length === 0) return { success: false, error: "Captura al menos un producto con cantidad mayor a cero." };
    if (notes && notes.length > 500) return { success: false, error: "La nota no puede superar 500 caracteres." };

    const [user, allowedBranchIds] = await Promise.all([
      getCurrentUser(),
      getAccessibleBranchIds(),
    ]);
    if (!user) return { success: false, error: "Tu sesión terminó. Vuelve a iniciar sesión." };
    if (!isBranchAllowed(allowedBranchIds, branchId)) {
      return { success: false, error: "No tienes permiso para registrar movimientos en esa sucursal." };
    }

    await recordWeeklyInventoryReceiptBatch({
      actorId: user.id,
      operationId,
      branchId,
      items,
      notes,
    });

    revalidatePath("/administration/inventory/branch-entries");
    revalidatePath("/administration/inventory/branch-entries/weekly");
    revalidatePath("/administration/inventory/sucursales");
    revalidatePath("/administration/inventory/sucursales/stock");

    return {
      success: true,
      message: `Entrada semanal registrada: ${items.length} productos.`,
      id: operationId,
    };
  } catch (error) {
    console.error("Error creating weekly inventory receipt:", error);
    if (error instanceof Error) {
      if (error.message === "WEEKLY_RECEIPT_DUPLICATE_PRODUCT") return { success: false, error: "Un producto aparece más de una vez en la captura." };
      if (error.message === "WEEKLY_RECEIPT_PRODUCT_NOT_AVAILABLE") return { success: false, error: "Uno de los productos ya no está activo o inventariable." };
      if (error.message === "WEEKLY_RECEIPT_UNIT_NOT_CONFIGURED") return { success: false, error: "Uno de los productos no tiene unidad base configurada." };
      if (error.message === "WEEKLY_RECEIPT_UNIT_MISMATCH") return { success: false, error: "La unidad de saldo de un producto no coincide con su configuración." };
      if (error.message === "PRESENTATION_NOT_CONFIGURED") return { success: false, error: "Configura la presentación comercial antes de capturar ese producto." };
      if (error.message === "COUNT_QUANTITY_REQUIRED" || error.message === "COUNT_QUANTITY_INVALID" || error.message === "COUNT_QUANTITY_PRECISION") return { success: false, error: "Revisa las cantidades: deben ser números no negativos con hasta 3 decimales." };
      if (error.message === "COUNT_PACKAGES_WHOLE" || error.message === "COUNT_LOOSE_PIECES_WHOLE" || error.message === "COUNT_LOOSE_PIECES_LIMIT") return { success: false, error: "Revisa los paquetes y piezas sueltas capturados." };
      if (error.message === "IDEMPOTENCY_KEY_REUSED") return { success: false, error: "La operación ya existe con otra captura. Recarga la página e intenta de nuevo." };
      if (error.message === "WEEKLY_RECEIPT_EMPTY") return { success: false, error: "Captura al menos un producto." };
    }
    return { success: false, error: error instanceof Error ? error.message : "No fue posible registrar la entrada semanal." };
  }
}
