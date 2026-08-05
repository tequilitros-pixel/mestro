"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PosActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

export async function createCategoryAction(
  formData: FormData,
): Promise<PosActionResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";

    if (!name) {
      return { success: false, error: "El nombre de la categoría es obligatorio." };
    }

    const lastCategory = await prisma.posCategory.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const created = await prisma.posCategory.create({
      data: {
        name,
        position: (lastCategory?.position ?? -1) + 1,
      },
      select: { id: true },
    });

    revalidatePath("/pos/categories");

    return { success: true, id: created.id, message: "Categoría creada correctamente." };
  } catch (error) {
    console.error("Error creating POS category:", error);
    return { success: false, error: "No fue posible crear la categoría." };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
): Promise<PosActionResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";

    if (!name) {
      return { success: false, error: "El nombre de la categoría es obligatorio." };
    }

    await prisma.posCategory.update({
      where: { id: categoryId },
      data: { name },
    });

    revalidatePath("/pos/categories");

    return { success: true, message: "Categoría actualizada correctamente." };
  } catch (error) {
    console.error("Error updating POS category:", error);
    return { success: false, error: "No fue posible actualizar la categoría." };
  }
}

export async function toggleCategoryActiveAction(
  categoryId: string,
  active: boolean,
): Promise<PosActionResult> {
  try {
    await prisma.posCategory.update({
      where: { id: categoryId },
      data: { active },
    });

    revalidatePath("/pos/categories");

    return { success: true, message: active ? "Categoría activada." : "Categoría desactivada." };
  } catch (error) {
    console.error("Error toggling POS category:", error);
    return { success: false, error: "No fue posible actualizar la categoría." };
  }
}

export async function reorderCategoriesAction(
  orderedIds: string[],
): Promise<PosActionResult> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.posCategory.update({ where: { id }, data: { position: index } }),
      ),
    );

    revalidatePath("/pos/categories");

    return { success: true, message: "Orden actualizado." };
  } catch (error) {
    console.error("Error reordering POS categories:", error);
    return { success: false, error: "No fue posible reordenar las categorías." };
  }
}

export async function moveProductToCategoryAction(
  productId: string,
  categoryId: string,
): Promise<PosActionResult> {
  try {
    const category = await prisma.posCategory.findUnique({ where: { id: categoryId } });

    if (!category) {
      return { success: false, error: "La categoría de destino no existe." };
    }

    await prisma.posProduct.update({
      where: { id: productId },
      data: { categoryId },
    });

    revalidatePath("/pos/categories");
    revalidatePath("/pos/products");

    return { success: true, message: `Producto movido a "${category.name}".` };
  } catch (error) {
    console.error("Error moving POS product to category:", error);
    return { success: false, error: "No fue posible mover el producto." };
  }
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<PosActionResult> {
  try {
    const productCount = await prisma.posProduct.count({ where: { categoryId } });

    if (productCount > 0) {
      return {
        success: false,
        error:
          "Esta categoría tiene productos asociados. Mueve o elimina esos productos antes, o mejor desactívala.",
      };
    }

    await prisma.posCategory.delete({ where: { id: categoryId } });

    revalidatePath("/pos/categories");

    return { success: true, message: "Categoría eliminada." };
  } catch (error) {
    console.error("Error deleting POS category:", error);
    return { success: false, error: "No fue posible eliminar la categoría." };
  }
}
