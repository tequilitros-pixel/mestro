"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { scaleRecipe } from "@/lib/liquors/RecipeEngine";

const MAX_RETRIES = 3;
const TIME_ZONE = "America/Mexico_City";

export async function createLiquorBatchAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const recipeId = String(formData.get("recipeId") ?? "").trim();
  const requestedLiters = Number(formData.get("requestedLiters"));

  if (!productId || !recipeId) {
    throw new Error("Falta identificar el producto o la receta.");
  }

  if (!Number.isFinite(requestedLiters) || requestedLiters <= 0) {
    throw new Error("Los litros solicitados deben ser mayores que cero.");
  }

  const recipe = await prisma.liquorRecipe.findFirst({
    where: {
      id: recipeId,
      productId,
      active: true,
    },
    include: {
      product: true,

      ingredients: {
        orderBy: {
          position: "asc",
        },
      },

      steps: {
        where: {
          active: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!recipe) {
    throw new Error("La receta seleccionada ya no está disponible.");
  }

  if (recipe.targetLiters === null || recipe.targetLiters <= 0) {
    throw new Error("La receta no tiene un volumen base válido.");
  }

  if (recipe.steps.length === 0) {
    throw new Error(
      "La receta todavía no tiene pasos sincronizados. Ejecuta npm run sync:liquor-steps."
    );
  }

  const calculatedRecipe = scaleRecipe(
    {
      targetLiters: recipe.targetLiters,
      targetAlcohol: recipe.targetAlcohol,
      ingredients: recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes,
        optional: ingredient.optional,
      })),
    },
    requestedLiters
  );

  let createdBatchId: string | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const createdBatch = await prisma.$transaction(async (tx) => {
        const lastBatch = await tx.liquorBatch.findFirst({
          orderBy: {
            sequence: "desc",
          },
          select: {
            sequence: true,
          },
        });

        const sequence = (lastBatch?.sequence ?? 0) + 1;
        const now = new Date();

        const code = buildBatchCode({
          prefix: recipe.product.prefix,
          sequence,
          date: now,
        });

        const batch = await tx.liquorBatch.create({
          data: {
            code,
            sequence,

            productId: recipe.productId,
            recipeId: recipe.id,

            status: "EN_ELABORACION",

            plannedLiters: requestedLiters,
            initialAlcohol: recipe.targetAlcohol,

            productionDate: now,
            startedAt: now,

            createdById: user.id,

            observations:
              `Orden calculada automáticamente con factor ` +
              `${calculatedRecipe.factor.toFixed(6)}.`,

            events: {
              create: {
                type: "INICIO_ELABORACION",
                createdById: user.id,
                liters: requestedLiters,
                notes:
                  `Elaboración iniciada con la receta ` +
                  `${recipe.name}, versión ${recipe.version}.`,
              },
            },
          },
        });

        /*
         * Guarda cada ingrediente calculado para este lote.
         *
         * El Map permite encontrar después el ingrediente
         * correspondiente a cada paso de la receta.
         */
        const batchIngredientsByRecipeIngredientId = new Map<
          string,
          {
            id: string;
            scaledQuantity: number;
            unit: string;
          }
        >();

        for (const ingredient of calculatedRecipe.ingredients) {
          const createdIngredient =
            await tx.liquorBatchIngredient.create({
              data: {
                batchId: batch.id,
                recipeIngredientId: ingredient.id,

                name: ingredient.name,

                baseQuantity: ingredient.quantity,
                scaledQuantity: ingredient.scaledQuantity,
                unit: ingredient.unit,

                notes: ingredient.notes ?? null,
              },
            });

          batchIngredientsByRecipeIngredientId.set(ingredient.id, {
            id: createdIngredient.id,
            scaledQuantity: createdIngredient.scaledQuantity,
            unit: createdIngredient.unit,
          });
        }

        /*
         * Copia los pasos oficiales hacia el lote.
         *
         * Desde este momento quedan congelados:
         * si la receta cambia después, este lote conserva
         * exactamente las instrucciones con las que nació.
         */
        for (const step of recipe.steps) {
          const relatedIngredient = step.recipeIngredientId
            ? batchIngredientsByRecipeIngredientId.get(
                step.recipeIngredientId
              )
            : undefined;

          await tx.liquorBatchStep.create({
            data: {
              batchId: batch.id,
              recipeStepId: step.id,

              position: step.position,
              type: step.type,
              status: "PENDIENTE",

              title: step.title,
              instruction: step.instruction,

              actions: step.actions,
              checks: step.checks,

              completedActionIndexes: [],
              completedCheckIndexes: [],

              batchIngredientId: relatedIngredient?.id ?? null,

              plannedQuantity:
                relatedIngredient?.scaledQuantity ?? null,

              actualQuantity: null,

              unit: relatedIngredient?.unit ?? null,

              durationMinutes: step.durationMinutes,
              minimumMinutes: step.minimumMinutes,
              maximumMinutes: step.maximumMinutes,

              actualMinutes: null,

              measurementLabel: step.measurementLabel,
              measurementUnit: step.measurementUnit,
              minimumValue: step.minimumValue,
              maximumValue: step.maximumValue,

              measuredValue: null,
              validationPassed: null,

              observations: step.notes,
            },
          });
        }

      return batch;
},
{
  maxWait: 10000,
  timeout: 30000,
}
);

      createdBatchId = createdBatch.id;
      break;
    } catch (error) {
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (!isUniqueConflict || attempt === MAX_RETRIES) {
        throw error;
      }
    }
  }

  if (!createdBatchId) {
    throw new Error("No fue posible generar el lote.");
  }

  redirect(`/liquors/batches/${createdBatchId}`);
}

function buildBatchCode({
  prefix,
  sequence,
  date,
}: {
  prefix: string;
  sequence: number;
  date: Date;
}) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return [
    prefix,
    day,
    month,
    year,
    String(sequence).padStart(3, "0"),
  ].join("-");
}

function getDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}