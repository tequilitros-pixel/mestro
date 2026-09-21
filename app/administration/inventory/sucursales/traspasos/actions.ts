"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, requireModuleActionAccess } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";

export type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function createTransferAction(formData: FormData): Promise<ActionResult> {
  try {
    try {
      await requireModuleActionAccess("/administration/inventory/sucursales/traspasos");
    } catch {
      return { success: false, error: "No tienes permiso para realizar traspasos." };
    }

    const fromBranchId = formData.get("fromBranchId")?.toString() ?? "";
    const toBranchId = formData.get("toBranchId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const quantityRaw = formData.get("quantity")?.toString() ?? "";
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!fromBranchId || !toBranchId || !productId) {
      return { success: false, error: "Selecciona sucursal origen, destino y producto." };
    }

    if (fromBranchId === toBranchId) {
      return { success: false, error: "La sucursal origen y destino no pueden ser la misma." };
    }

    const allowedBranchIds = await getAccessibleBranchIds();
    if (!isBranchAllowed(allowedBranchIds, fromBranchId) || !isBranchAllowed(allowedBranchIds, toBranchId)) {
      return { success: false, error: "No tienes acceso a una de las sucursales seleccionadas." };
    }

    const product = await prisma.inventoryProduct.findFirst({
      where: { id: productId, isActive: true, archivedAt: null, trackStock: true },
      select: { id: true },
    });
    if (!product) {
      return { success: false, error: "No se puede traspasar un producto inactivo, archivado o no inventariable." };
    }

    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findUnique({ where: { id: fromBranchId }, select: { name: true } }),
      prisma.branch.findUnique({ where: { id: toBranchId }, select: { name: true } }),
    ]);

    if (!fromBranch || !toBranch) {
      return { success: false, error: "Sucursal no encontrada." };
    }

    await prisma.$transaction([
      prisma.inventoryEntry.create({
        data: {
          branchId: fromBranchId,
          productId,
          type: "TRASPASO",
          quantity: -quantity,
          notes: `Traspaso a ${toBranch.name}${notes ? `: ${notes}` : ""}`,
        },
      }),
      prisma.inventoryEntry.create({
        data: {
          branchId: toBranchId,
          productId,
          type: "TRASPASO",
          quantity,
          notes: `Traspaso desde ${fromBranch.name}${notes ? `: ${notes}` : ""}`,
        },
      }),
    ]);

    revalidatePath("/administration/inventory/sucursales/traspasos");
    revalidatePath("/administration/inventory/sucursales");
    revalidatePath("/administration/inventory/sucursales/stock");
    revalidatePath("/administration/inventory/branch-entries");

    return { success: true, message: "Traspaso registrado correctamente." };
  } catch (error) {
    console.error("Error creating transfer:", error);
    return { success: false, error: "No fue posible registrar el traspaso." };
  }
}
