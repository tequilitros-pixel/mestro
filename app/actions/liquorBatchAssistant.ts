"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function completeLiquorIngredientAction(
  formData: FormData
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batchId = String(formData.get("batchId") ?? "");
  const ingredientId = String(formData.get("ingredientId") ?? "");

  const actualQuantityValue = String(
    formData.get("actualQuantity") ?? ""
  ).trim();

  const actualQuantity =
    actualQuantityValue === ""
      ? null
      : Number(actualQuantityValue);

  if (!batchId || !ingredientId) {
    throw new Error("Falta identificar el lote o el ingrediente.");
  }

  if (
    actualQuantity !== null &&
    (!Number.isFinite(actualQuantity) || actualQuantity < 0)
  ) {
    throw new Error("La cantidad real no es válida.");
  }

  const ingredient =
    await prisma.liquorBatchIngredient.findFirst({
      where: {
        id: ingredientId,
        batchId,
      },
      include: {
        batch: true,
      },
    });

  if (!ingredient) {
    throw new Error("No se encontró el ingrediente.");
  }

  if (ingredient.batch.status !== "EN_ELABORACION") {
    throw new Error(
      "Este lote ya no se encuentra en elaboración."
    );
  }

  await prisma.$transaction([
    prisma.liquorBatchIngredient.update({
      where: {
        id: ingredient.id,
      },
      data: {
        completed: true,
        actualQuantity:
          actualQuantity ?? ingredient.scaledQuantity,
        completedAt: new Date(),
      },
    }),

    prisma.liquorBatchEvent.create({
      data: {
        batchId,
        type: "INGREDIENTE_AGREGADO",
        ingredientName: ingredient.name,
        ingredientQuantity:
          actualQuantity ?? ingredient.scaledQuantity,
        ingredientUnit: ingredient.unit,
        createdById: user.id,
        notes: "Ingrediente confirmado por el operador.",
      },
    }),
  ]);

  revalidatePath(`/liquors/batches/${batchId}`);
}