"use server";

import { revalidatePath } from "next/cache";
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

    if (!Object.values(InventoryEntryType).includes(typeValue as InventoryEntryType)) {
      return { success: false, error: "Selecciona un tipo de entrada válido." };
    }

    if (typeValue === "TRASPASO") {
      return {
        success: false,
        error: "Usa Traspasos para mover stock entre sucursales.",
      };
    }

    const signedQuantity =
      typeValue === "AJUSTE" && direction === "RESTA" ? -quantity : quantity;

    const entry = await prisma.inventoryEntry.create({
      data: {
        branchId,
        productId,
        type: typeValue as InventoryEntryType,
        quantity: signedQuantity,
        unitCost,
        notes,
      },
      select: { id: true },
    });

    revalidatePath("/administration/inventory/branch-entries");

    return { success: true, message: "Entrada registrada correctamente.", id: entry.id };
  } catch (error) {
    console.error("Error creating inventory entry:", error);
    return { success: false, error: "No fue posible registrar la entrada." };
  }
}
