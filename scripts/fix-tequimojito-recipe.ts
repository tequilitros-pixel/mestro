import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;
const actorId = process.env.POS2_RECIPE_SYNC_ACTOR_ID;
const apply = process.argv.includes("--apply");

if (!connectionString) throw new Error("A production database connection is required.");
if (apply && !actorId) {
  throw new Error("POS2_RECIPE_SYNC_ACTOR_ID is required for an auditable change.");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const [oldIngredient, mintIngredient, variants] = await Promise.all([
    prisma.inventoryProduct.findUnique({ where: { code: "POS-ING-MOJITO" } }),
    prisma.inventoryProduct.findUnique({ where: { code: "LIC-MENTA" } }),
    prisma.posProductVariant.findMany({
      where: { product: { name: "Tequimojito" } },
      orderBy: { name: "asc" },
      include: {
        product: { select: { name: true } },
        ingredients: { include: { inventoryProduct: { select: { code: true, name: true } } } },
      },
    }),
  ]);

  if (!oldIngredient || !mintIngredient) {
    throw new Error("No se encontraron ambos insumos del catálogo.");
  }
  if (!variants.length) throw new Error("No se encontraron variantes de Tequimojito.");

  const replacements = variants.flatMap((variant) => {
    const oldRows = variant.ingredients.filter(
      (ingredient) => ingredient.inventoryProductId === oldIngredient.id,
    );
    const existingMintRows = variant.ingredients.filter(
      (ingredient) => ingredient.inventoryProductId === mintIngredient.id,
    );
    if (existingMintRows.length > 1 || oldRows.length > 1) {
      throw new Error(`Receta ambigua en Tequimojito / ${variant.name}.`);
    }
    if (oldRows.length && existingMintRows.length) {
      throw new Error(`La receta ya contiene ambos insumos en Tequimojito / ${variant.name}.`);
    }
    return oldRows.map((ingredient) => ({
      variantId: variant.id,
      variantName: variant.name,
      ingredientId: ingredient.id,
      quantity: ingredient.quantity.toString(),
    }));
  });

  if (!replacements.length) {
    console.log(JSON.stringify({ apply, changed: 0, message: "La receta ya usa LIC-MENTA." }, null, 2));
    return;
  }

  const operationId = randomUUID();
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const replacement of replacements) {
        await tx.posVariantIngredient.update({
          where: { id: replacement.ingredientId },
          data: { inventoryProductId: mintIngredient.id },
        });
        await tx.auditEvent.create({
          data: {
            actorId,
            action: "POS2_RECIPE_INGREDIENT_REASSIGNED",
            entityType: "PosVariantIngredient",
            entityId: replacement.ingredientId,
            operationId,
            metadata: {
              product: "Tequimojito",
              variant: replacement.variantName,
              fromCode: oldIngredient.code,
              fromName: oldIngredient.name,
              toCode: mintIngredient.code,
              toName: mintIngredient.name,
              quantity: replacement.quantity,
              historicalMovementsPreserved: true,
            },
          },
        });
      }
      await tx.outboxEvent.create({
        data: {
          topic: "pos2.recipe-ingredient-reassigned",
          aggregate: "Pos2RecipeConfiguration",
          aggregateId: operationId,
          operationId,
          payload: {
            product: "Tequimojito",
            fromCode: oldIngredient.code,
            toCode: mintIngredient.code,
            changed: replacements.length,
          },
        },
      });
    });
  }

  console.log(
    JSON.stringify(
      {
        apply,
        changed: replacements.length,
        operationId: apply ? operationId : null,
        replacements: replacements.map(({ variantName, quantity }) => ({ variantName, quantity })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
