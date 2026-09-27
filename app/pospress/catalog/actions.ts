"use server";

import { CatalogBaseUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireModuleActionAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POS_PERMISSION = "/pos";
const BASE_UNITS = ["UNIT", "ML", "G"] as const;

type ActionResult = { success: true; id: string; message: string } | { success: false; error: string };

function text(value: unknown, max = 160) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function createPosCategoryAction(input: { name: string }): Promise<ActionResult> {
  try {
    const actor = await requireModuleActionAccess(POS_PERMISSION);
    const name = text(input.name);
    if (!name) return { success: false, error: "Escribe el nombre de la categoría." };

    const last = await prisma.posCategory.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const category = await prisma.posCategory.create({
      data: {
        name,
        position: (last?.position ?? -1) + 1,
        createdById: actor.id,
      },
      select: { id: true },
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    return { success: true, id: category.id, message: "Categoría creada correctamente." };
  } catch (error) {
    console.error("Error creating POS category:", error);
    return { success: false, error: "No fue posible crear la categoría." };
  }
}

export async function createPosProductAction(input: {
  categoryId: string;
  name: string;
  description?: string;
  variantName?: string;
  price: number;
  baseUnit: string;
  inventoryTracked: boolean;
  ingredients: Array<{ inventoryProductId: string; quantity: number }>;
}): Promise<ActionResult> {
  try {
    const actor = await requireModuleActionAccess(POS_PERMISSION);
    const name = text(input.name);
    const categoryId = text(input.categoryId);
    const variantName = text(input.variantName) ?? "Único";
    const description = text(input.description, 500);
    const price = Number(input.price);

    if (!name) return { success: false, error: "Escribe el nombre del producto." };
    if (!categoryId) return { success: false, error: "Selecciona una categoría." };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: "El precio no es válido." };
    if (!BASE_UNITS.includes(input.baseUnit as (typeof BASE_UNITS)[number])) {
      return { success: false, error: "Selecciona una unidad base válida." };
    }
    if (input.ingredients.length > 0 && !input.inventoryTracked) {
      return { success: false, error: "Activa el control de existencias para guardar una receta." };
    }

    const uniqueIngredients = new Map<string, number>();
    for (const ingredient of input.ingredients) {
      const inventoryProductId = text(ingredient.inventoryProductId);
      const quantity = positiveNumber(ingredient.quantity);
      if (!inventoryProductId || quantity === null) {
        return { success: false, error: "Cada ingrediente debe tener producto y cantidad mayor a cero." };
      }
      if (uniqueIngredients.has(inventoryProductId)) {
        return { success: false, error: "No repitas el mismo ingrediente en la receta." };
      }
      uniqueIngredients.set(inventoryProductId, quantity);
    }

    const [category, inventoryProducts] = await Promise.all([
      prisma.posCategory.findUnique({ where: { id: categoryId }, select: { id: true, active: true } }),
      uniqueIngredients.size
        ? prisma.inventoryProduct.findMany({
            where: { id: { in: [...uniqueIngredients.keys()] }, isActive: true },
            select: { id: true, inventoryBaseUnit: true, trackStock: true },
          })
        : Promise.resolve([]),
    ]);

    if (!category?.active) return { success: false, error: "La categoría no está disponible." };
    if (inventoryProducts.length !== uniqueIngredients.size) {
      return { success: false, error: "Uno de los ingredientes ya no está activo en inventario." };
    }
    if (inventoryProducts.some((product) => !product.trackStock || !product.inventoryBaseUnit)) {
      return { success: false, error: "Cada ingrediente debe tener existencias y unidad base configuradas." };
    }

    const inventoryById = new Map(inventoryProducts.map((product) => [product.id, product]));
    const last = await prisma.posProduct.findFirst({
      where: { categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.posProduct.create({
        data: {
          categoryId,
          name,
          description,
          sellable: true,
          inventoryTracked: input.inventoryTracked,
          baseUnit: input.baseUnit as CatalogBaseUnit,
          position: (last?.position ?? -1) + 1,
          createdById: actor.id,
        },
        select: { id: true },
      });

      await tx.posProductVariant.create({
        data: {
          productId: created.id,
          name: variantName,
          price,
          baseUnit: input.baseUnit as CatalogBaseUnit,
          ingredients: {
            create: [...uniqueIngredients.entries()].map(([inventoryProductId, quantity]) => {
              const inventoryProduct = inventoryById.get(inventoryProductId)!;
              return {
                inventoryProductId,
                quantity,
                unit: inventoryProduct.inventoryBaseUnit!,
                unitStatus: "RESOLVED" as const,
              };
            }),
          },
        },
      });

      return created;
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    return { success: true, id: product.id, message: "Producto y receta creados correctamente." };
  } catch (error) {
    console.error("Error creating POS product:", error);
    return { success: false, error: "No fue posible crear el producto. Revisa los datos e inténtalo nuevamente." };
  }
}

export async function updatePosCategoryAction(input: { id: string; name: string }): Promise<ActionResult> {
  try {
    await requireModuleActionAccess(POS_PERMISSION);
    const id = text(input.id);
    const name = text(input.name);
    if (!id || !name) return { success: false, error: "Escribe el nombre de la categoría." };
    const category = await prisma.posCategory.update({ where: { id }, data: { name }, select: { id: true } });
    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    return { success: true, id: category.id, message: "Categoría actualizada correctamente." };
  } catch (error) {
    console.error("Error updating POS category:", error);
    return { success: false, error: "No fue posible actualizar la categoría." };
  }
}

export async function updatePosProductAction(input: {
  productId: string;
  variantId?: string;
  categoryId: string;
  name: string;
  description?: string;
  variantName?: string;
  price: number;
  baseUnit: string;
  inventoryTracked: boolean;
  ingredients: Array<{ inventoryProductId: string; quantity: number }>;
}): Promise<ActionResult> {
  try {
    const actor = await requireModuleActionAccess(POS_PERMISSION);
    const productId = text(input.productId);
    const categoryId = text(input.categoryId);
    const name = text(input.name);
    const variantName = text(input.variantName) ?? "Único";
    const description = text(input.description, 500);
    const price = Number(input.price);
    if (!productId || !name || !categoryId) return { success: false, error: "Completa categoría y nombre." };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: "El precio no es válido." };
    if (!BASE_UNITS.includes(input.baseUnit as (typeof BASE_UNITS)[number])) return { success: false, error: "Selecciona una unidad base válida." };
    if (input.ingredients.length > 0 && !input.inventoryTracked) return { success: false, error: "Activa el control de existencias para guardar una receta." };

    const uniqueIngredients = new Map<string, number>();
    for (const ingredient of input.ingredients) {
      const inventoryProductId = text(ingredient.inventoryProductId);
      const quantity = positiveNumber(ingredient.quantity);
      if (!inventoryProductId || quantity === null) return { success: false, error: "Cada ingrediente debe tener producto y cantidad mayor a cero." };
      if (uniqueIngredients.has(inventoryProductId)) return { success: false, error: "No repitas el mismo ingrediente en la receta." };
      uniqueIngredients.set(inventoryProductId, quantity);
    }

    const [category, inventoryProducts, current] = await Promise.all([
      prisma.posCategory.findUnique({ where: { id: categoryId }, select: { id: true, active: true } }),
      uniqueIngredients.size ? prisma.inventoryProduct.findMany({ where: { id: { in: [...uniqueIngredients.keys()] }, isActive: true }, select: { id: true, inventoryBaseUnit: true, trackStock: true } }) : Promise.resolve([]),
      prisma.posProduct.findUnique({ where: { id: productId }, include: { variants: { where: input.variantId ? { id: input.variantId } : undefined, orderBy: { position: "asc" }, take: 1, select: { id: true, productId: true } } } }),
    ]);
    if (!category?.active || !current?.active) return { success: false, error: "El producto o la categoría no están disponibles." }; if (input.variantId && current.variants[0]?.productId !== productId) return { success: false, error: "La presentación no pertenece al producto seleccionado." };
    if (inventoryProducts.length !== uniqueIngredients.size) return { success: false, error: "Uno de los ingredientes ya no está activo en inventario." };
    if (inventoryProducts.some((product) => !product.trackStock || !product.inventoryBaseUnit)) return { success: false, error: "Cada ingrediente debe tener existencias y unidad base configuradas." };
    const inventoryById = new Map(inventoryProducts.map((product) => [product.id, product]));

    await prisma.$transaction(async (tx) => {
      await tx.posProduct.update({ where: { id: productId }, data: { categoryId, name, description, inventoryTracked: input.inventoryTracked, baseUnit: input.baseUnit as CatalogBaseUnit, version: { increment: 1 } } });
      const variant = current.variants[0]
        ? await tx.posProductVariant.update({ where: { id: current.variants[0].id }, data: { name: variantName, price, baseUnit: input.baseUnit as CatalogBaseUnit, version: { increment: 1 } }, select: { id: true } })
        : await tx.posProductVariant.create({ data: { productId, name: variantName, price, baseUnit: input.baseUnit as CatalogBaseUnit }, select: { id: true } });
      await tx.posVariantIngredient.deleteMany({ where: { variantId: variant.id } });
      if (uniqueIngredients.size) {
        await tx.posVariantIngredient.createMany({ data: [...uniqueIngredients.entries()].map(([inventoryProductId, quantity]) => ({ inventoryProductId, quantity, variantId: variant.id, unit: inventoryById.get(inventoryProductId)!.inventoryBaseUnit!, unitStatus: "RESOLVED" as const })) });
      }
      void actor;
    });
    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    return { success: true, id: productId, message: "Producto y receta actualizados correctamente." };
  } catch (error) {
    console.error("Error updating POS product:", error);
    return { success: false, error: "No fue posible actualizar el producto. Revisa los datos e inténtalo nuevamente." };
  }
}
