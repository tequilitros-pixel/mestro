import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { recipeSteps } from "../lib/liquors/recipeSteps";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log("📋 Sincronizando pasos...");

  for (const [slug, steps] of Object.entries(recipeSteps)) {
    const product = await prisma.liquorProduct.findUnique({
      where: { slug },
      include: {
        recipes: {
          where: { active: true },
        },
      },
    });

    if (!product) continue;

    const recipe = product.recipes[0];

    if (!recipe) continue;

    await prisma.liquorRecipeStep.deleteMany({
      where: {
        recipeId: recipe.id,
      },
    });

    for (const step of steps) {
      let recipeIngredientId: string | undefined = undefined;

      if ("ingredient" in step && step.ingredient) {
        const ingredient =
          await prisma.liquorRecipeIngredient.findFirst({
            where: {
              recipeId: recipe.id,
              name: step.ingredient,
            },
          });

        recipeIngredientId = ingredient?.id;
      }

      await prisma.liquorRecipeStep.create({
  data: {
    recipeId: recipe.id,
    position: step.position,
    type: getStepType(step),

    title: step.title,
    instruction: step.instruction,

    actions: [],
    checks: [],

    recipeIngredientId,

    durationMinutes:
      "minutes" in step && typeof step.minutes === "number"
        ? step.minutes
        : null,

    minimumMinutes:
      "hours" in step && typeof step.hours === "number"
        ? step.hours * 60
        : null,
  },
});
    }

    console.log(`✅ ${slug}`);
  }

  console.log("🎉 Pasos sincronizados.");
}
function getStepType(step: {
  ingredient?: string;
  minutes?: number;
  hours?: number;
  title: string;
}) {
  if (step.ingredient) {
    return "INGREDIENT" as const;
  }

  if (typeof step.hours === "number") {
    return "WAIT" as const;
  }

  if (typeof step.minutes === "number") {
    return "MIXING" as const;
  }

  if (step.title.toLowerCase().includes("preparar")) {
    return "PREPARATION" as const;
  }

  if (step.title.toLowerCase().includes("liberar")) {
    return "FINISH" as const;
  }

  return "QUALITY_CHECK" as const;
}
main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });