import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { LIQUOR_RECIPES } from "../lib/liquors/recipes";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No existe DATABASE_URL. Revisa tu archivo .env."
  );
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🍹 Sincronizando recetas oficiales...");

  for (const recipeDefinition of LIQUOR_RECIPES) {
    const product = await prisma.liquorProduct.findUnique({
      where: {
        slug: recipeDefinition.productSlug,
      },
    });

    if (!product) {
      throw new Error(
        `No existe el producto con slug "${recipeDefinition.productSlug}".`
      );
    }

    const existingRecipe = await prisma.liquorRecipe.findUnique({
      where: {
        productId_version: {
          productId: product.id,
          version: recipeDefinition.version,
        },
      },
    });

    const instructions =
      recipeDefinition.instructions.join("\n");

    const masterTips =
      recipeDefinition.masterTips?.length
        ? `\n\nEXPERIENCIA DEL MAESTRO:\n${recipeDefinition.masterTips
            .map((tip) => `- ${tip}`)
            .join("\n")}`
        : "";

    const notes = [
      recipeDefinition.notes,
      masterTips,
    ]
      .filter(Boolean)
      .join("\n");

    const recipe = existingRecipe
      ? await prisma.liquorRecipe.update({
          where: {
            id: existingRecipe.id,
          },
          data: {
            name: recipeDefinition.name,
            targetLiters: recipeDefinition.targetLiters,
            targetAlcohol:
              recipeDefinition.targetAlcohol ?? null,
            instructions,
            notes: notes || null,
            active: true,
          },
        })
      : await prisma.liquorRecipe.create({
          data: {
            productId: product.id,
            name: recipeDefinition.name,
            version: recipeDefinition.version,
            targetLiters: recipeDefinition.targetLiters,
            targetAlcohol:
              recipeDefinition.targetAlcohol ?? null,
            instructions,
            notes: notes || null,
            active: true,
          },
        });

    await prisma.liquorRecipeIngredient.deleteMany({
      where: {
        recipeId: recipe.id,
      },
    });

    await prisma.liquorRecipeIngredient.createMany({
      data: recipeDefinition.ingredients.map(
        (ingredient, index) => ({
          recipeId: recipe.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          position: index + 1,
          optional: ingredient.optional ?? false,
          notes: ingredient.notes ?? null,
        })
      ),
    });

    console.log(
      `✅ ${product.name} · versión ${recipeDefinition.version}`
    );
  }

  console.log("✅ Recetas sincronizadas correctamente.");
}

main()
  .catch((error) => {
    console.error(
      "❌ Error sincronizando recetas:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });