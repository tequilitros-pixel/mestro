"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RawMaterialMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyMovement } from "./rawMaterials";

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
      // Se trae la receta del ingrediente para saber a qué materia
      // prima descontarle lo que se acaba de agregar.
      batchIngredient: {
        include: {
          recipeIngredient: {
            select: {
              rawMaterialId: true,
              rawMaterial: { select: { name: true, baseUnit: true } },
            },
          },
        },
      },
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

    /*
     * Descuento del almacén de materia prima.
     *
     * Se hace aquí, al completar el paso, con la cantidad REAL que
     * capturó el operador — no con la planeada — para que el stock
     * refleje lo que de verdad se usó.
     *
     * Solo aplica si el ingrediente de la receta está vinculado a una
     * materia prima. Si no lo está, la elaboración continúa igual: no
     * se bloquea el proceso por un catálogo incompleto.
     */
    const rawMaterialId =
      step.batchIngredient?.recipeIngredient?.rawMaterialId ?? null;

    const consumed = actualQuantity ?? step.batchIngredient?.scaledQuantity ?? 0;

    if (rawMaterialId && consumed > 0) {
      await applyMovement(tx, {
        rawMaterialId,
        type: RawMaterialMovementType.CONSUMO_RECETA,
        amount: consumed,
        liquorBatchId: batchId,
        createdById: user.id,
        notes: `Consumido en ${step.batch.code} · paso ${step.position}: ${step.title}.`,
      });
    }
  });

  revalidatePath(`/liquors/batches/${batchId}`);
}