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

export async function deletePosProductAction(input: { productId: string }): Promise<ActionResult> {
  try {
    await requireModuleActionAccess(POS_PERMISSION);
    const productId = text(input.productId);
    if (!productId) return { success: false, error: "Identificador de producto inválido." };

    await prisma.$transaction(async (tx) => {
      await tx.posProduct.update({
        where: { id: productId },
        data: { active: false },
      });
      await tx.posProductVariant.updateMany({
        where: { productId },
        data: { active: false },
      });
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    revalidatePath("/pospress/recipes");
    return { success: true, id: productId, message: "Producto retirado del punto de venta." };
  } catch (error) {
    console.error("Error deleting POS product:", error);
    return { success: false, error: "No fue posible retirar el producto." };
  }
}

export async function updateRecipeQuantitiesAction(input: {
  variantId: string;
  ingredients: Array<{ inventoryProductId: string; quantity: number }>;
}): Promise<ActionResult> {
  try {
    await requireModuleActionAccess(POS_PERMISSION);
    const variantId = text(input.variantId);
    if (!variantId) return { success: false, error: "Presentación no encontrada." };

    const variant = await prisma.posProductVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant) return { success: false, error: "Presentación no encontrada." };

    const uniqueIngredients = new Map<string, number>();
    for (const item of input.ingredients) {
      const pid = text(item.inventoryProductId);
      const qty = positiveNumber(item.quantity);
      if (!pid || qty === null) {
        return { success: false, error: "Cada ingrediente debe tener producto y cantidad mayor a cero." };
      }
      uniqueIngredients.set(pid, qty);
    }

    const inventoryProducts = uniqueIngredients.size
      ? await prisma.inventoryProduct.findMany({
          where: { id: { in: [...uniqueIngredients.keys()] }, isActive: true },
          select: { id: true, unit: true, inventoryBaseUnit: true },
        })
      : [];

    const inventoryMap = new Map(inventoryProducts.map((p) => [p.id, p]));

    await prisma.$transaction(async (tx) => {
      await tx.posVariantIngredient.deleteMany({ where: { variantId } });
      if (uniqueIngredients.size > 0) {
        await tx.posVariantIngredient.createMany({
          data: [...uniqueIngredients.entries()].map(([inventoryProductId, quantity]) => {
            const invProd = inventoryMap.get(inventoryProductId);
            const baseUnit = invProd?.inventoryBaseUnit ?? (invProd?.unit?.toLowerCase() === "ml" ? "ML" : invProd?.unit?.toLowerCase() === "g" ? "G" : "UNIT");
            return {
              variantId,
              inventoryProductId,
              quantity,
              unit: baseUnit,
              unitStatus: "RESOLVED" as const,
            };
          }),
        });
        await tx.posProduct.update({
          where: { id: variant.productId },
          data: { inventoryTracked: true },
        });
      }
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    revalidatePath("/pospress/recipes");
    return { success: true, id: variantId, message: "Receta actualizada correctamente." };
  } catch (error) {
    console.error("Error updating recipe quantities:", error);
    return { success: false, error: "No fue posible actualizar las cantidades de la receta." };
  }
}

export async function createPosVariantAction(input: {
  productId: string;
  name: string;
  price: number;
  ingredients: Array<{ inventoryProductId: string; quantity: number }>;
}): Promise<ActionResult> {
  try {
    const actor = await requireModuleActionAccess(POS_PERMISSION);
    const productId = text(input.productId);
    const name = text(input.name);
    const price = Number(input.price);

    if (!productId || !name) return { success: false, error: "Escribe el nombre de la variedad (ej. Grande, Con Tequila...)." };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: "El precio no es válido." };

    const product = await prisma.posProduct.findUnique({
      where: { id: productId },
      select: { id: true, baseUnit: true, active: true },
    });
    if (!product || !product.active) return { success: false, error: "El producto principal no está disponible." };

    const last = await prisma.posProductVariant.findFirst({
      where: { productId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const uniqueIngredients = new Map<string, number>();
    for (const item of input.ingredients) {
      const pid = text(item.inventoryProductId);
      const qty = positiveNumber(item.quantity);
      if (pid && qty !== null) {
        uniqueIngredients.set(pid, qty);
      }
    }

    const inventoryProducts = uniqueIngredients.size
      ? await prisma.inventoryProduct.findMany({
          where: { id: { in: [...uniqueIngredients.keys()] }, isActive: true },
          select: { id: true, unit: true, inventoryBaseUnit: true },
        })
      : [];
    const inventoryMap = new Map(inventoryProducts.map((p) => [p.id, p]));

    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.posProductVariant.create({
        data: {
          productId,
          name,
          price,
          baseUnit: product.baseUnit,
          position: (last?.position ?? -1) + 1,
          ingredients: {
            create: [...uniqueIngredients.entries()].map(([inventoryProductId, quantity]) => {
              const inv = inventoryMap.get(inventoryProductId);
              const baseUnit = inv?.inventoryBaseUnit ?? (inv?.unit?.toLowerCase() === "ml" ? "ML" : inv?.unit?.toLowerCase() === "g" ? "G" : "UNIT");
              return {
                inventoryProductId,
                quantity,
                unit: baseUnit,
                unitStatus: "RESOLVED" as const,
              };
            }),
          },
        },
        select: { id: true },
      });

      if (uniqueIngredients.size > 0) {
        await tx.posProduct.update({
          where: { id: productId },
          data: { inventoryTracked: true },
        });
      }

      return created;
    });

    void actor;
    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    revalidatePath("/pospress/recipes");
    return { success: true, id: variant.id, message: `Variedad "${name}" agregada con su receta.` };
  } catch (error) {
    console.error("Error creating POS variant:", error);
    return { success: false, error: "No fue posible agregar la variedad al producto." };
  }
}

export async function deletePosVariantAction(input: { variantId: string }): Promise<ActionResult> {
  try {
    await requireModuleActionAccess(POS_PERMISSION);
    const variantId = text(input.variantId);
    if (!variantId) return { success: false, error: "Identificador de variedad inválido." };

    const variant = await prisma.posProductVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { variants: { where: { active: true } } } } },
    });
    if (!variant) return { success: false, error: "Variedad no encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.posProductVariant.update({
        where: { id: variantId },
        data: { active: false },
      });

      // Si era la única variedad activa, desactivar también el producto
      if (variant.product.variants.length <= 1) {
        await tx.posProduct.update({
          where: { id: variant.productId },
          data: { active: false },
        });
      }
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    revalidatePath("/pospress/recipes");
    return { success: true, id: variantId, message: "Variedad retirada del producto." };
  } catch (error) {
    console.error("Error deleting POS variant:", error);
    return { success: false, error: "No fue posible retirar la variedad." };
  }
}

export async function createMultiVariantProductAction(input: {
  categoryId: string;
  name: string;
  description?: string;
  variants: Array<{
    name: string;
    price: number;
    ingredients: Array<{ inventoryProductId: string; quantity: number }>;
  }>;
}): Promise<ActionResult> {
  try {
    const actor = await requireModuleActionAccess(POS_PERMISSION);
    const categoryId = text(input.categoryId);
    const name = text(input.name);
    const description = text(input.description, 500);

    if (!categoryId || !name) return { success: false, error: "Completa categoría y nombre del producto." };
    if (!Array.isArray(input.variants) || input.variants.length === 0) {
      return { success: false, error: "Agrega al menos una variedad (ej. Mediano o Grande)." };
    }

    const last = await prisma.posProduct.findFirst({
      where: { categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    // Recolectar todos los ingredientes usados
    const allIngredientIds = new Set<string>();
    for (const v of input.variants) {
      for (const ing of v.ingredients) {
        if (ing.inventoryProductId) allIngredientIds.add(ing.inventoryProductId);
      }
    }

    const inventoryProducts = allIngredientIds.size
      ? await prisma.inventoryProduct.findMany({
          where: { id: { in: [...allIngredientIds] }, isActive: true },
          select: { id: true, unit: true, inventoryBaseUnit: true },
        })
      : [];
    const inventoryMap = new Map(inventoryProducts.map((p) => [p.id, p]));

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.posProduct.create({
        data: {
          categoryId,
          name,
          description,
          sellable: true,
          inventoryTracked: true,
          baseUnit: "UNIT",
          position: (last?.position ?? -1) + 1,
          createdById: actor.id,
        },
        select: { id: true },
      });

      for (let i = 0; i < input.variants.length; i++) {
        const v = input.variants[i];
        const vName = text(v.name) || "Único";
        const vPrice = Number(v.price) || 0;

        await tx.posProductVariant.create({
          data: {
            productId: created.id,
            name: vName,
            price: vPrice,
            baseUnit: "UNIT",
            position: i,
            ingredients: {
              create: v.ingredients.map((ing) => {
                const inv = inventoryMap.get(ing.inventoryProductId);
                const baseUnit = inv?.inventoryBaseUnit ?? (inv?.unit?.toLowerCase() === "ml" ? "ML" : inv?.unit?.toLowerCase() === "g" ? "G" : "UNIT");
                return {
                  inventoryProductId: ing.inventoryProductId,
                  quantity: ing.quantity,
                  unit: baseUnit,
                  unitStatus: "RESOLVED" as const,
                };
              }),
            },
          },
        });
      }

      return created;
    });

    revalidatePath("/pospress/catalog");
    revalidatePath("/pospress");
    revalidatePath("/pospress/recipes");
    return { success: true, id: product.id, message: `Producto "${name}" creado con sus ${input.variants.length} variedades y recetas.` };
  } catch (error) {
    console.error("Error creating multi-variant product:", error);
    return { success: false, error: "No fue posible crear el producto con sus variedades." };
  }
}
