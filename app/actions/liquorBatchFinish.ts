"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function finishLiquorBatchAction(
  formData: FormData
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batchId = String(
    formData.get("batchId") ?? ""
  ).trim();

  const actualLiters = Number(
    formData.get("actualLiters")
  );

  const finalAlcohol = Number(
    formData.get("finalAlcohol")
  );

  const notes = String(
    formData.get("notes") ?? ""
  ).trim();

  if (!batchId) {
    throw new Error("No se pudo identificar el lote.");
  }

  if (
    !Number.isFinite(actualLiters) ||
    actualLiters <= 0
  ) {
    throw new Error(
      "Los litros finales deben ser mayores que cero."
    );
  }

  if (
    !Number.isFinite(finalAlcohol) ||
    finalAlcohol < 0 ||
    finalAlcohol > 100
  ) {
    throw new Error(
      "El alcohol final debe estar entre 0 y 100."
    );
  }

  const batch = await prisma.liquorBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      steps: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("El lote no existe.");
  }

  if (batch.status === "PAUSADO") {
    throw new Error(
      "Debes reanudar el lote antes de finalizarlo."
    );
  }

  const hasPendingSteps = batch.steps.some(
    (step) => step.status !== "COMPLETADO"
  );

  if (hasPendingSteps) {
    throw new Error(
      "No se puede finalizar el lote porque aún existen pasos pendientes."
    );
  }

  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      await tx.liquorBatch.update({
        where: {
          id: batchId,
        },
        data: {
          status: "LISTO_PARA_EMBOTELLAR",
          actualLiters,
          finalAlcohol,
          finalNotes: notes || null,
          finishedAt: now,
          finishedById: user.id,
        },
      });

      await tx.liquorBatchEvent.create({
        data: {
          batchId,
          type: "FIN_ELABORACION",
          createdById: user.id,
          liters: actualLiters,
          alcohol: finalAlcohol,
          notes: notes
            ? `Lote finalizado. Observaciones: ${notes}`
            : "Lote finalizado y liberado para embotellado.",
        },
      });
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  redirect(`/liquors/batches/${batchId}`);
}