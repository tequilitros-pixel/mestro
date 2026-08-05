"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function createTransferAction(formData: FormData): Promise<ActionResult> {
  try {
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
