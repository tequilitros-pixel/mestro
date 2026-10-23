"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/auth";

export type UpdateBranchInventoryMinimumResult =
  | { success: true; minimumQuantity: string }
  | { success: false; error: string };

function parseMinimum(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const minimum = Number(normalized);
  if (!Number.isFinite(minimum) || minimum < 0) return null;
  return minimum;
}

/**
 * Guarda el mínimo operativo de un producto para una sucursal. Esta
 * configuración no crea movimientos ni modifica conteos o existencias.
 */
export async function updateBranchInventoryMinimumAction(input: {
  branchId: string;
  inventoryProductId: string;
  minimumQuantity: string;
}): Promise<UpdateBranchInventoryMinimumResult> {
  try {
    await requireAdminAction();

    const minimumQuantity = parseMinimum(input.minimumQuantity);
    if (minimumQuantity === null) {
      return { success: false, error: "El mínimo debe ser un número igual o mayor a cero." };
    }

    const [branch, product] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: input.branchId, active: true },
        select: { id: true },
      }),
      prisma.inventoryProduct.findFirst({
        where: {
          id: input.inventoryProductId,
          isActive: true,
          archivedAt: null,
          trackStock: true,
        },
        select: { id: true },
      }),
    ]);

    if (!branch || !product) {
      return { success: false, error: "La sucursal o el producto ya no están disponibles." };
    }

    await prisma.branchInventoryMinimum.upsert({
      where: {
        branchId_inventoryProductId: {
          branchId: branch.id,
          inventoryProductId: product.id,
        },
      },
      create: {
        branchId: branch.id,
        inventoryProductId: product.id,
        minimumQuantity,
      },
      update: { minimumQuantity },
    });

    revalidatePath("/administration/inventory/sucursales/stock");
    revalidatePath("/administration/inventory/sucursales");

    return { success: true, minimumQuantity: String(minimumQuantity) };
  } catch (error) {
    console.error("Error updating branch inventory minimum:", error);
    return { success: false, error: "No fue posible guardar el mínimo de esta sucursal." };
  }
}
