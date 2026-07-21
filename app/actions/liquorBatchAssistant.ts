"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function completeLiquorBatchStepAction(
  formData: FormData
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  const stepId = String(formData.get("stepId") ?? "").trim();

  const actualQuantityText = String(
    formData.get("actualQuantity") ?? ""
  ).trim();

  const completedCheckIndexes = formData
    .getAll("completedCheckIndexes")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  if (!batchId || !stepId) {
    throw new Error("Falta identificar el lote o el paso.");
  }

  const step = await prisma.liquorBatchStep.findFirst({
    where: {
      id: stepId,
      batchId,
    },
    include: {
      batch: true,
      batchIngredient: true,
    },
  });

  if (!step) {
    throw new Error("No se encontró el paso solicitado.");
  }

  if (step.batch.status !== "EN_ELABORACION") {
    throw new Error(
      "Este lote ya no se encuentra en elaboración."
    );
  }

  if (step.status === "COMPLETADO") {
    revalidatePath(`/liquors/batches/${batchId}`);
    return;
  }

  const previousPendingStep =
    await prisma.liquorBatchStep.findFirst({
      where: {
        batchId,
        position: {
          lt: step.position,
        },
        status: {
          not: "COMPLETADO",
        },
      },
      orderBy: {
        position: "asc",
      },
    });

  if (previousPendingStep) {
    throw new Error(
      "Debes completar los pasos anteriores antes de continuar."
    );
  }

  const requiredCheckIndexes = step.checks.map(
    (_, index) => index
  );

  const allChecksCompleted = requiredCheckIndexes.every(
    (index) => completedCheckIndexes.includes(index)
  );

  if (!allChecksCompleted) {
    throw new Error(
      "Debes confirmar todas las verificaciones antes de finalizar el paso."
    );
  }

  let actualQuantity: number | null = null;

  if (step.plannedQuantity !== null) {
    actualQuantity =
      actualQuantityText === ""
        ? step.plannedQuantity
        : Number(actualQuantityText);

    if (
      !Number.isFinite(actualQuantity) ||
      actualQuantity < 0
    ) {
      throw new Error("La cantidad real utilizada no es válida.");
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.liquorBatchStep.update({
      where: {
        id: step.id,
      },
      data: {
        status: "COMPLETADO",
        actualQuantity,
        completedActionIndexes: step.actions.map(
          (_, index) => index
        ),
        completedCheckIndexes,
        startedAt: step.startedAt ?? now,
        completedAt: now,
        completedById: user.id,
        validationPassed: true,
      },
    });

    if (step.batchIngredientId) {
      await tx.liquorBatchIngredient.update({
        where: {
          id: step.batchIngredientId,
        },
        data: {
          completed: true,
          actualQuantity:
            actualQuantity ??
            step.batchIngredient?.scaledQuantity ??
            null,
          completedAt: now,
        },
      });
    }

    await tx.liquorBatchEvent.create({
      data: {
        batchId,
        type: "OBSERVACION",
        createdById: user.id,
        ingredientName:
          step.batchIngredient?.name ?? null,
        ingredientQuantity: actualQuantity,
        ingredientUnit: step.unit,
        notes: `Paso ${step.position} completado: ${step.title}.`,
      },
    });

   
  });

  revalidatePath(`/liquors/batches/${batchId}`);
}