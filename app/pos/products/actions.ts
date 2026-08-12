"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PosActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

type IngredientInput = {
  inventoryProductId: string;
  quantity: number;
};

type VariantInput = {
  id?: string;
  name: string;
  price: number;
  employeePrice: number | null;
  ingredients: IngredientInput[];
};

function parseVariants(raw: string | null): VariantInput[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((v) => ({
      id: typeof v.id === "string" ? v.id : undefined,
      name: typeof v.name === "string" ? v.name.trim() : "",
      price: Number(v.price),
      employeePrice:
        v.employeePrice === null || v.employeePrice === undefined || v.employeePrice === ""
          ? null
          : Number(v.employeePrice),
      ingredients: Array.isArray(v.ingredients)
        ? v.ingredients
            .filter(
              (i: unknown): i is IngredientInput =>
                typeof (i as IngredientInput)?.inventoryProductId === "string" &&
                Number.isFinite(Number((i as IngredientInput)?.quantity)),
            )
            .map((i: IngredientInput) => ({
              inventoryProductId: i.inventoryProductId,
              quantity: Number(i.quantity),
            }))
        : [],
    }));
  } catch {
    return null;
  }
}

function validateVariants(variants: VariantInput[]): string | null {
  if (variants.length === 0) {
    return "Agrega al menos una variante (por ejemplo, \"Único\" con su precio).";
  }

  for (const variant of variants) {
    if (!variant.name) {
      return "Cada variante necesita un nombre.";
    }
    if (!(variant.price >= 0) || !Number.isFinite(variant.price)) {
      return `El precio de "${variant.name}" no es válido.`;
    }
    if (
      variant.employeePrice !== null &&
      (!(variant.employeePrice >= 0) || !Number.isFinite(variant.employeePrice))
    ) {
      return `El precio de empleado de "${variant.name}" no es válido.`;
    }
    for (const ingredient of variant.ingredients) {
      if (!(ingredient.quantity > 0)) {
        return `Una cantidad de ingrediente en "${variant.name}" no es válida.`;
      }
    }
  }

  return null;
}

/**
 * Crea un producto junto con sus variantes e ingredientes en una sola
 * transacción. Las variantes llegan serializadas como JSON en el campo
 * "variants" del formulario (nombre, precio y receta de ingredientes
 * por variante), ya que el número de filas es dinámico en la UI.
 */
export async function createProductAction(
  formData: FormData,
): Promise<PosActionResult> {
  try {
    const categoryId = formData.get("categoryId")?.toString().trim() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";
    const icon = formData.get("icon")?.toString().trim() || null;
    const variants = parseVariants(formData.get("variants")?.toString() ?? null);

    if (!categoryId) {
      return { success: false, error: "Selecciona una categoría." };
    }

    if (!name) {
      return { success: false, error: "El nombre del producto es obligatorio." };
    }

    if (!variants) {
      return { success: false, error: "No se pudo leer la información de las variantes." };
    }

    const validationError = validateVariants(variants);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const category = await prisma.posCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      return { success: false, error: "La categoría seleccionada no existe." };
    }

    const lastProduct = await prisma.posProduct.findFirst({
      where: { categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.posProduct.create({
        data: {
          categoryId,
          name,
          icon,
          position: (lastProduct?.position ?? -1) + 1,
        },
        select: { id: true },
      });

      for (const [index, variant] of variants.entries()) {
        await tx.posProductVariant.create({
          data: {
            productId: product.id,
            name: variant.name,
            price: variant.price,
            employeePrice: variant.employeePrice,
            position: index,
            ingredients: {
              create: variant.ingredients.map((ingredient) => ({
                inventoryProductId: ingredient.inventoryProductId,
                quantity: ingredient.quantity,
              })),
            },
          },
        });
      }

      return product;
    });

    revalidatePath("/pos/products");

    return { success: true, id: created.id, message: "Producto creado correctamente." };
  } catch (error) {
    console.error("Error creating POS product:", error);
    return { success: false, error: "No fue posible crear el producto." };
  }
}

/**
 * Reemplaza el árbol completo de variantes/ingredientes de un producto.
 * Es más simple y menos propenso a errores que hacer un diff fino de
 * altas/bajas/cambios: se borran las variantes existentes (en cascada
 * se llevan sus ingredientes) y se vuelven a crear con lo que llegó
 * del formulario. Las variantes ya vendidas conservan su historial
 * porque PosSaleItem copia nombre/precio al momento de la venta.
 */
export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<PosActionResult> {
  try {
    const categoryId = formData.get("categoryId")?.toString().trim() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";
    const icon = formData.get("icon")?.toString().trim() || null;
    const variants = parseVariants(formData.get("variants")?.toString() ?? null);

    if (!categoryId) {
      return { success: false, error: "Selecciona una categoría." };
    }

    if (!name) {
      return { success: false, error: "El nombre del producto es obligatorio." };
    }

    if (!variants) {
      return { success: false, error: "No se pudo leer la información de las variantes." };
    }

    const validationError = validateVariants(variants);
    if (validationError) {
      return { success: false, error: validationError };
    }

    await prisma.$transaction(async (tx) => {
      await tx.posProduct.update({
        where: { id: productId },
        data: { categoryId, name, icon },
      });

      await tx.posProductVariant.deleteMany({ where: { productId } });

      for (const [index, variant] of variants.entries()) {
        await tx.posProductVariant.create({
          data: {
            productId,
            name: variant.name,
            price: variant.price,
            employeePrice: variant.employeePrice,
            position: index,
            ingredients: {
              create: variant.ingredients.map((ingredient) => ({
                inventoryProductId: ingredient.inventoryProductId,
                quantity: ingredient.quantity,
              })),
            },
          },
        });
      }
    });

    revalidatePath("/pos/products");
    revalidatePath(`/pos/products/${productId}`);

    return { success: true, message: "Producto actualizado correctamente." };
  } catch (error) {
    console.error("Error updating POS product:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}

export async function toggleProductActiveAction(
  productId: string,
  active: boolean,
): Promise<PosActionResult> {
  try {
    await prisma.posProduct.update({ where: { id: productId }, data: { active } });

    revalidatePath("/pos/products");

    return { success: true, message: active ? "Producto activado." : "Producto desactivado." };
  } catch (error) {
    console.error("Error toggling POS product:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}

export async function toggleVariantActiveAction(
  variantId: string,
  active: boolean,
): Promise<PosActionResult> {
  try {
    await prisma.posProductVariant.update({ where: { id: variantId }, data: { active } });

    revalidatePath("/pos/products");

    return { success: true, message: active ? "Variante activada." : "Variante desactivada." };
  } catch (error) {
    console.error("Error toggling POS variant:", error);
    return { success: false, error: "No fue posible actualizar la variante." };
  }
}

export async function deleteProductAction(
  productId: string,
): Promise<PosActionResult> {
  try {
    const saleItemCount = await prisma.posSaleItem.count({
      where: { variant: { productId } },
    });

    if (saleItemCount > 0) {
      return {
        success: false,
        error:
          "Este producto ya tiene ventas registradas. No se puede eliminar sin perder ese historial — mejor desactívalo.",
      };
    }

    await prisma.posProduct.delete({ where: { id: productId } });

    revalidatePath("/pos/products");

    return { success: true, message: "Producto eliminado." };
  } catch (error) {
    console.error("Error deleting POS product:", error);
    return { success: false, error: "No fue posible eliminar el producto." };
  }
}
