import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { INGREDIENTS, PRODUCTS } from "../lib/pos/tequilitrosSeedData";

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
    const saved = await prisma.inventoryProduct.upsert({
      where: { code: ingredient.code },
      update: {
        name: ingredient.name,
        unit: ingredient.unit,
      },
      create: {
        code: ingredient.code,
        name: ingredient.name,
        category: "Insumos Bar (Tequilitros)",
        unit: ingredient.unit,
        itemType: "CONSUMABLE",
        trackStock: true,
        trackBatch: false,
        trackExpiration: false,
        canBeSold: false,
        mustReturn: false,
        minimumStock: 0,
        isActive: true,
      },
      select: { id: true, code: true },
    });
    ingredientIds.set(saved.code, saved.id);
    console.log(`  ✓ ${ingredient.name} (${ingredient.code})`);
  }

  // 2. Categorías del punto de venta (upsert por nombre).
  console.log("\nCategorías:");
  const categoryIds = new Map<string, string>();
  const categoryNames = [...new Set(PRODUCTS.map((p) => p.categoryName))];

  for (const [index, name] of categoryNames.entries()) {
    let category = await prisma.posCategory.findFirst({ where: { name } });

    if (!category) {
      category = await prisma.posCategory.create({
        data: { name, position: index },
      });
    }

    categoryIds.set(name, category.id);
    console.log(`  ✓ ${name}`);
  }

  // 3. Productos + variantes + recetas de ingredientes.
  //    Idempotente: si el producto ya existe (mismo nombre+categoría),
  //    se reemplazan sus variantes/ingredientes por completo.
  console.log("\nProductos:");

  for (const [index, productDef] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(productDef.categoryName)!;

    let product = await prisma.posProduct.findFirst({
      where: { categoryId, name: productDef.name },
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
        data: { icon: productDef.color, active: true },
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
