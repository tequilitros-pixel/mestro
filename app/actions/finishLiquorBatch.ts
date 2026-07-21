"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LiquorBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FinishLiquorBatchInput = {
  batchId: string;
  notes?: string;
};

type FinishLiquorBatchResult =
  | {
      success: true;
      remainingLiters: number;
    }
  | {
      success: false;
      error: string;
    };

export async function finishLiquorBatchWithRemainderAction(
  input: FinishLiquorBatchInput
): Promise<FinishLiquorBatchResult> {
  try {
    const userId = await getAuthenticatedUserId();

    const batchId = input.batchId.trim();
    const notes = input.notes?.trim() || null;

    if (!batchId) {
      return {
        success: false,
        error: "No se recibió el lote que será finalizado.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.liquorBatch.findUnique({
        where: {
          id: batchId,
        },
        select: {
          id: true,
          code: true,
          status: true,
          actualLiters: true,
          plannedLiters: true,
          finalNotes: true,
          bottlings: {
            select: {
              litersUsed: true,
            },
          },
        },
      });

      if (!batch) {
        throw new Error("El lote seleccionado no existe.");
      }

      const allowedStatuses: LiquorBatchStatus[] = [
        LiquorBatchStatus.LISTO_PARA_EMBOTELLAR,
        LiquorBatchStatus.EMBOTELLANDO,
      ];

      if (!allowedStatuses.includes(batch.status)) {
        throw new Error(
          "Este lote no se encuentra disponible para finalizar el embotellado."
        );
      }

      const totalBatchLiters =
        batch.actualLiters ?? batch.plannedLiters;

      if (
        !Number.isFinite(totalBatchLiters) ||
        totalBatchLiters <= 0
      ) {
        throw new Error(
          "El lote no tiene un volumen válido registrado."
        );
      }

      const bottledLiters = roundLiters(
        batch.bottlings.reduce(
          (total, bottling) =>
            total + (bottling.litersUsed ?? 0),
          0
        )
      );

      const remainingLiters = roundLiters(
        Math.max(totalBatchLiters - bottledLiters, 0)
      );

      const closureNote = [
        `Lote finalizado con remanente de ${formatLiters(
          remainingLiters
        )} L.`,
        notes,
      ]
        .filter(Boolean)
        .join(" ");

      const previousNotes = batch.finalNotes?.trim();

      const finalNotes = previousNotes
        ? `${previousNotes}\n${closureNote}`
        : closureNote;

      await tx.liquorBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status: LiquorBatchStatus.TERMINADO,
          finishedAt: new Date(),
          finishedById: userId,
          finalNotes,
        },
      });

      return {
        remainingLiters,
      };
    });

    revalidatePath("/liquors/batches");
    revalidatePath(`/liquors/batches/${batchId}`);
    revalidatePath(`/liquors/batches/${batchId}/bottling`);
    revalidatePath("/liquors/bottling");
    revalidatePath("/liquors/inventory");

    return {
      success: true,
      remainingLiters: result.remainingLiters,
    };
  } catch (error) {
    console.error(
      "Error al finalizar el lote con remanente:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible finalizar el lote.",
    };
  }
}

async function getAuthenticatedUserId() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("maestro_user")?.value;

  if (!userId) {
    throw new Error(
      "Tu sesión no está disponible. Inicia sesión nuevamente."
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("El usuario de la sesión ya no existe.");
  }

  return user.id;
}

function roundLiters(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatLiters(value: number) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}