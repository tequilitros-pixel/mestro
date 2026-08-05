"use server";

import { InventoryItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type CreateInventoryProductResult =
  | {
      success: true;
      productId: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function readBoolean(formData: FormData, field: string) {
  return formData.get(field) === "on";
}

function readOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value.toString().trim() === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

export async function createInventoryProductAction(
  formData: FormData,
): Promise<CreateInventoryProductResult> {
  try {
    const code = formData.get("code")?.toString().trim().toUpperCase() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";
    const description =
      formData.get("description")?.toString().trim() || null;
    const category = formData.get("category")?.toString().trim() ?? "";
    const unit = formData.get("unit")?.toString().trim() ?? "";
    const itemTypeValue = formData.get("itemType")?.toString() ?? "";

    const unitCost = readOptionalNumber(formData.get("unitCost"));
    const minimumStock =
      readOptionalNumber(formData.get("minimumStock")) ?? 0;

    if (!code) {
      return {
        success: false,
        error: "El código del producto es obligatorio.",
      };
    }

    if (!name) {
      return {
        success: false,
        error: "El nombre del producto es obligatorio.",
      };
    }

    if (!category) {
      return {
        success: false,
        error: "Selecciona una categoría.",
      };
    }

    if (!unit) {
      return {
        success: false,
        error: "Selecciona una unidad de medida.",
      };
    }

    if (
      !Object.values(InventoryItemType).includes(
        itemTypeValue as InventoryItemType,
      )
    ) {
      return {
        success: false,
        error: "Selecciona un tipo de producto válido.",
      };
    }

    if (unitCost !== null && unitCost < 0) {
      return {
        success: false,
        error: "El costo unitario no puede ser negativo.",
      };
    }

    if (minimumStock < 0) {
      return {
        success: false,
        error: "La existencia mínima no puede ser negativa.",
      };
    }

    const existingProduct = await prisma.inventoryProduct.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (existingProduct) {
      return {
        success: false,
        error: `Ya existe un producto con el código ${code}.`,
      };
    }

    const selectedPackageIds = formData.getAll("packages").map((v) => v.toString());

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryProduct.create({
        data: {
          code,
          name,
          description,
          category,
          unit,
          unitCost,
          minimumStock,
          itemType: itemTypeValue as InventoryItemType,
          trackStock: readBoolean(formData, "trackStock"),
          trackBatch: readBoolean(formData, "trackBatch"),
          trackExpiration: readBoolean(formData, "trackExpiration"),
          canBeSold: readBoolean(formData, "canBeSold"),
          mustReturn: readBoolean(formData, "mustReturn"),
          isActive: true,
        },
        select: { id: true },
      });

      for (const packageId of selectedPackageIds) {
        const quantity =
          readOptionalNumber(formData.get(`quantity-${packageId}`)) ?? 1;

        await tx.eventPackageItem.create({
          data: {
            packageId,
            productId: created.id,
            quantity,
            calculationType: "FIXED",
            isRequired: true,
          },
        });
      }

      return created;
    });

    revalidatePath("/administration/inventory/products");
    revalidatePath("/administration/inventory/event-packages");

    return {
      success: true,
      productId: product.id,
      message: "Producto creado correctamente.",
    };
  } catch (error) {
    console.error("Error creating inventory product:", error);

    return {
      success: false,
      error: "No fue posible crear el producto. Inténtalo nuevamente.",
    };
  }
}
export async function toggleProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { isActive },
    });

    revalidatePath("/administration/inventory/products");

    return { success: true };
  } catch (error) {
    console.error("Error toggling product:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}
export async function updateInventoryProductAction(
  productId: string,
  formData: FormData,
): Promise<CreateInventoryProductResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";
    const description = formData.get("description")?.toString().trim() || null;
    const category = formData.get("category")?.toString().trim() ?? "";
    const unit = formData.get("unit")?.toString().trim() ?? "";
    const itemTypeValue = formData.get("itemType")?.toString() ?? "";
    const unitCost = readOptionalNumber(formData.get("unitCost"));
    const minimumStock = readOptionalNumber(formData.get("minimumStock")) ?? 0;

    if (!name) {
      return { success: false, error: "El nombre del producto es obligatorio." };
    }

    if (!category) {
      return { success: false, error: "Selecciona una categoría." };
    }

    if (!unit) {
      return { success: false, error: "Selecciona una unidad de medida." };
    }

    if (!Object.values(InventoryItemType).includes(itemTypeValue as InventoryItemType)) {
      return { success: false, error: "Selecciona un tipo de producto válido." };
    }

    if (unitCost !== null && unitCost < 0) {
      return { success: false, error: "El costo unitario no puede ser negativo." };
    }

    if (minimumStock < 0) {
      return { success: false, error: "La existencia mínima no puede ser negativa." };
    }

    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: {
        name,
        description,
        category,
        unit,
        unitCost,
        minimumStock,
        itemType: itemTypeValue as InventoryItemType,
        trackStock: readBoolean(formData, "trackStock"),
        trackBatch: readBoolean(formData, "trackBatch"),
        trackExpiration: readBoolean(formData, "trackExpiration"),
        canBeSold: readBoolean(formData, "canBeSold"),
        mustReturn: readBoolean(formData, "mustReturn"),
      },
    });

    revalidatePath("/administration/inventory/products");
    revalidatePath(`/administration/inventory/products/${productId}`);

    return { success: true, productId, message: "Producto actualizado correctamente." };
  } catch (error) {
    console.error("Error updating inventory product:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}

export async function deleteInventoryProductAction(
  productId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const [packageUses, eventUses, kitUses, countUses, entryUses] = await Promise.all([
      prisma.eventPackageItem.count({ where: { productId } }),
      prisma.serviceEventItem.count({ where: { productId } }),
      prisma.equipmentKitItem.count({ where: { productId } }),
      prisma.inventoryCountItem.count({ where: { productId } }),
      prisma.inventoryEntry.count({ where: { productId } }),
    ]);

    const totalUses = packageUses + eventUses + kitUses + countUses + entryUses;

    if (totalUses > 0) {
      return {
        success: false,
        error:
          "Este producto ya se usó en paquetes, eventos, kits o movimientos. No se puede eliminar sin perder ese historial — mejor desactívalo.",
      };
    }

    await prisma.inventoryProduct.delete({ where: { id: productId } });

    revalidatePath("/administration/inventory/products");

    return { success: true };
  } catch (error) {
    console.error("Error deleting inventory product:", error);
    return { success: false, error: "No fue posible eliminar el producto." };
  }
}

