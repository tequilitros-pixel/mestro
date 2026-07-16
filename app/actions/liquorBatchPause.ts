"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function pauseLiquorBatchAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!batchId) {
    throw new Error("No se pudo identificar el lote.");
  }

  if (!reason) {
    throw new Error("Debes seleccionar el motivo de la pausa.");
  }

  const batch = await prisma.liquorBatch.findUnique({
    where: {
      id: batchId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!batch) {
    throw new Error("El lote no existe.");
  }

  if (batch.status !== "EN_ELABORACION") {
    throw new Error(
      "Solo se puede pausar un lote que está en elaboración."
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.liquorBatch.update({
      where: {
        id: batchId,
      },
      data: {
        status: "PAUSADO",
        pausedAt: now,
        pausedById: user.id,
        pauseReason: reason,
        pauseNotes: notes || null,
      },
    });

    await tx.liquorBatchEvent.create({
      data: {
        batchId,
        type: "OBSERVACION",
        createdById: user.id,
        notes: [
          "⏸ Elaboración pausada.",
          `Motivo: ${reason}.`,
          notes ? `Observaciones: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  });

  redirect(`/liquors/batches/${batchId}`);
}

export async function resumeLiquorBatchAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batchId = String(formData.get("batchId") ?? "").trim();

  if (!batchId) {
    throw new Error("No se pudo identificar el lote.");
  }

  const batch = await prisma.liquorBatch.findUnique({
    where: {
      id: batchId,
    },
    select: {
      id: true,
      status: true,
      pauseReason: true,
    },
  });

  if (!batch) {
    throw new Error("El lote no existe.");
  }

  if (batch.status !== "PAUSADO") {
    throw new Error("Este lote no se encuentra pausado.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.liquorBatch.update({
      where: {
        id: batchId,
      },
      data: {
        status: "EN_ELABORACION",
        pausedAt: null,
        pausedById: null,
        pauseReason: null,
        pauseNotes: null,
      },
    });

    await tx.liquorBatchEvent.create({
      data: {
        batchId,
        type: "OBSERVACION",
        createdById: user.id,
        notes: `▶ Elaboración reanudada. Pausa anterior: ${
          batch.pauseReason ?? "Sin motivo registrado"
        }.`,
      },
    });
  });

  redirect(`/liquors/batches/${batchId}`);
}