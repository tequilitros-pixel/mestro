"use server";

import { InventoryContentUnit, InventoryHandlingUnit, InventoryItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORIES } from "./categories";

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
const handlingUnits: Record<string, InventoryHandlingUnit> = { Pieza: "PIEZA", Botella: "BOTELLA", Caja: "CAJA", Paquete: "PAQUETE", Garrafa: "GARRAFA", Kilogramo: "KILOGRAMO", Litro: "LITRO", Costal: "OTRA", Bolsa: "OTRA", Mililitro: "OTRA", Gramo: "OTRA", Metro: "OTRA" };
function readPresentation(formData: FormData, unit: string) {
  const contentPerUnit = readOptionalNumber(formData.get("contentPerUnit")); const contentUnitValue = formData.get("contentUnit")?.toString() ?? "";
  if (contentPerUnit === null && !contentUnitValue) return { handlingUnit: handlingUnits[unit] ?? "OTRA", contentPerUnit: null, contentUnit: null, normalizedContentPerUnit: null };
  if (contentPerUnit === null || contentPerUnit <= 0 || !Object.values(InventoryContentUnit).includes(contentUnitValue as InventoryContentUnit)) throw new Error("Captura un contenido por unidad mayor a cero y su unidad.");
  const contentUnit = contentUnitValue as InventoryContentUnit; const normalizedContentPerUnit = contentPerUnit * ({ ML: 1, L: 1000, G: 1, KG: 1000, PIEZAS: 1 }[contentUnit]);
  return { handlingUnit: handlingUnits[unit] ?? "OTRA", contentPerUnit, contentUnit, normalizedContentPerUnit };
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
    const presentation = readPresentation(formData, unit);

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

    const product = await prisma.inventoryProduct.create({
        data: {
          code,
          name,
          description,
          category,
          unit,
          ...presentation,
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

    revalidatePath("/administration/inventory/products");
    revalidatePath("/administration/inventory/event-packages");
    revalidatePath("/administration/inventory/events/new");

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
    revalidatePath("/administration/inventory/event-packages");
    revalidatePath("/administration/inventory/events/new");

    return { success: true };
  } catch (error) {
    console.error("Error toggling product:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}
export async function updateProductCategoryAction(
  productId: string,
  category: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!PRODUCT_CATEGORIES.includes(category as (typeof PRODUCT_CATEGORIES)[number])) {
      return { success: false, error: "Selecciona una categoría válida." };
    }

    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { category },
    });

    revalidatePath("/administration/inventory/products");
    revalidatePath(`/administration/inventory/products/${productId}`);
    revalidatePath("/administration/inventory/event-packages");
    revalidatePath("/administration/inventory/events/new");

    return { success: true };
  } catch (error) {
    console.error("Error updating product category:", error);
    return { success: false, error: "No fue posible cambiar la categoría." };
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
    const presentation = readPresentation(formData, unit);

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
        ...presentation,
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
    const [packageUses, eventUses, kitUses, countUses, entryUses, posRecipeUses] = await Promise.all([
      prisma.eventPackageItem.count({ where: { productId } }),
      prisma.serviceEventItem.count({ where: { productId } }),
      prisma.equipmentKitItem.count({ where: { productId } }),
      prisma.inventoryCountItem.count({ where: { productId } }),
      prisma.inventoryEntry.count({ where: { productId } }),
      prisma.posVariantIngredient.count({ where: { inventoryProductId: productId } }),
    ]);

    const totalUses = packageUses + eventUses + kitUses + countUses + entryUses + posRecipeUses;

    if (totalUses > 0) {
      return {
        success: false,
        error:
          "Este producto ya se usó en paquetes, eventos, kits, movimientos o recetas del POS. No se puede eliminar sin perder ese historial — mejor desactívalo.",
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
