import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { INGREDIENTS, PRODUCTS, EQUIPMENT_ITEMS } from "../lib/pos/tequilitrosSeedData";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("No existe DATABASE_URL. Revisa tu archivo .env.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌵 Sembrando catálogo de Punto de Venta (Tequilitros)...\n");

  // 1. Ingredientes crudos en Inventario (upsert por código).
  console.log("Ingredientes:");
  const ingredientIds = new Map<string, string>();

  for (const ingredient of INGREDIENTS) {
    const inventoryBaseUnit = ingredient.unit === "ml" ? "ML" as const : ingredient.unit === "Pza" ? "UNIT" as const : null;
    // canBeSold: true en todos — así quedan disponibles como insumos
    // seleccionables al armar paquetes/kits de Eventos, además de
    // usarse como receta del Punto de Venta. isActive: true los deja
    // visibles para cualquier sucursal (el catálogo no está limitado
    // por sucursal).
    const saved = await prisma.inventoryProduct.upsert({
      where: { code: ingredient.code },
      update: {
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category,
        canBeSold: true,
        isActive: true,
        inventoryBaseUnit,
      },
      create: {
        code: ingredient.code,
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        itemType: "CONSUMABLE",
        trackStock: true,
        trackBatch: false,
        trackExpiration: false,
        canBeSold: true,
        mustReturn: false,
        minimumStock: 0,
        isActive: true,
        inventoryBaseUnit,
      },
      select: { id: true, code: true },
    });
    ingredientIds.set(saved.code, saved.id);
    console.log(`  ✓ ${ingredient.name} (${ingredient.code})`);
  }

  // 1.5. Equipo/insumos de logística (upsert por código). No son
  // ingredientes de receta, así que no se marcan canBeSold: se siembran
  // para poder armarlos en Paquetes de Evento y llevar su control de
  // existencias/retorno.
  console.log("\nEquipo / Logística:");

  for (const item of EQUIPMENT_ITEMS) {
    await prisma.inventoryProduct.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        unit: item.unit,
        category: item.category,
        itemType: item.itemType,
        mustReturn: item.mustReturn,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        itemType: item.itemType,
        trackStock: true,
        trackBatch: false,
        trackExpiration: false,
        canBeSold: false,
        mustReturn: item.mustReturn,
        minimumStock: 0,
        isActive: true,
      },
    });
    console.log(`  ✓ ${item.name} (${item.code})`);
  }

  // 2. Categorías del punto de venta (upsert por nombre).
  //    CATEGORY_RENAMES mapea nombres legados -> nombre nuevo: si la
  //    categoría vieja existe en la base, se renombra en vez de crear
  //    una categoría nueva y dejar la vieja huérfana.
  console.log("\nCategorías:");
  const CATEGORY_RENAMES: Record<string, string> = {
    "Cócteles": "Tequilitros",
  };
  const categoryIds = new Map<string, string>();
  const categoryNames = [...new Set(PRODUCTS.map((p) => p.categoryName))];

  for (const [index, name] of categoryNames.entries()) {
    let category = await prisma.posCategory.findFirst({ where: { name } });

    if (!category) {
      const legacyName = Object.entries(CATEGORY_RENAMES).find(
        ([, newName]) => newName === name,
      )?.[0];

      const legacyCategory = legacyName
        ? await prisma.posCategory.findFirst({ where: { name: legacyName } })
        : null;

      if (legacyCategory) {
        category = await prisma.posCategory.update({
          where: { id: legacyCategory.id },
          data: { name },
        });
        console.log(`  ✓ ${legacyName} → ${name} (renombrada)`);
      } else {
        category = await prisma.posCategory.create({
          data: { name, position: index },
        });
      }
    }

    categoryIds.set(name, category.id);
    console.log(`  ✓ ${name}`);
  }

  // 3. Productos + variantes + recetas de ingredientes.
  //    Idempotente: se busca el producto por NOMBRE (no por
  //    nombre+categoría) para que, si alguna vez quedó en la categoría
  //    equivocada (p. ej. un reacomodo de menú), el reseed lo corrija en
  //    vez de crear un duplicado en la categoría nueva.
  console.log("\nProductos:");

  for (const [index, productDef] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(productDef.categoryName)!;

    let product = await prisma.posProduct.findFirst({
      where: { name: productDef.name },
    });

    if (!product) {
      product = await prisma.posProduct.create({
        data: {
          categoryId,
          name: productDef.name,
          icon: productDef.color,
          position: index,
        },
      });
    } else {
      await prisma.posProduct.update({
        where: { id: product.id },
        data: { categoryId, icon: productDef.color, active: true },
      });
      await prisma.posProductVariant.deleteMany({
        where: { productId: product.id },
      });
    }

    for (const [variantIndex, variantDef] of productDef.variants.entries()) {
      await prisma.posProductVariant.create({
        data: {
          productId: product.id,
          name: variantDef.name,
          price: variantDef.price,
          position: variantIndex,
          ingredients: {
            create: variantDef.ingredients.map((ing) => ({
              inventoryProductId: ingredientIds.get(ing.ingredientCode)!,
              quantity: ing.quantity,
              ...(() => { const legacyUnit = INGREDIENTS.find((item) => item.code === ing.ingredientCode)?.unit; return legacyUnit === "ml" ? { unit: "ML" as const, unitStatus: "RESOLVED" as const } : legacyUnit === "Pza" ? { unit: "UNIT" as const, unitStatus: "RESOLVED" as const } : {}; })(),
            })),
          },
        },
      });
    }

    console.log(
      `  ✓ ${productDef.name} (${productDef.variants.map((v) => `${v.name} $${v.price}`).join(", ")})`,
    );
  }

  console.log("\n✅ Listo. Revisa Punto de Venta > Categorías / Productos.");
}

main()
  .catch((error) => {
    console.error("\n❌ Error sembrando el catálogo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
