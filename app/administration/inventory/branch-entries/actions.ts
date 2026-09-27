"use server";

import { revalidatePath } from "next/cache";
import { recordManualInventoryMovement } from "@/lib/inventory/manualMovements";
import { prisma } from "@/lib/prisma";
import { InventoryEntryType } from "@prisma/client";
import { getAccessibleBranchIds, getCurrentUser, requireModuleActionAccess } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";

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
