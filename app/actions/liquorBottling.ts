"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  LiquorBatchStatus,
  LiquorBottlingStatus,
  LiquorBottleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateLiquorBottlingInput = {
  batchId: string;
  bottleSizeMl: number;
  filledBottles: number;
  rejectedBottles: number;
  notes?: string;
};

type CreateLiquorBottlingResult =
  | {
      success: true;
      bottlingId: string;
      bottlingCode: string;
      producedBottles: number;
      rejectedBottles: number;
      litersUsed: number;
      lossLiters: number;
      remainingLiters: number;
    }
  | {
      success: false;
      error: string;
    };

const ALLOWED_BOTTLE_SIZES = [250, 500, 750, 1000, 2000];

export async function createLiquorBottlingAction(
  input: CreateLiquorBottlingInput
): Promise<CreateLiquorBottlingResult> {
  try {
    const userId = await getAuthenticatedUserId();

    const batchId = input.batchId.trim();
    const bottleSizeMl = Math.trunc(input.bottleSizeMl);
    const filledBottles = Math.trunc(input.filledBottles);
    const rejectedBottles = Math.trunc(input.rejectedBottles);
    const notes = input.notes?.trim() || null;

    if (!batchId) {
      return {
        success: false,
        error: "No se recibió el lote que será embotellado.",
      };
    }

    if (!ALLOWED_BOTTLE_SIZES.includes(bottleSizeMl)) {
      return {
        success: false,
        error: "La presentación seleccionada no es válida.",
      };
    }

    if (!Number.isInteger(filledBottles) || filledBottles <= 0) {
      return {
        success: false,
        error: "Debes registrar al menos una botella llenada.",
      };
    }

    if (!Number.isInteger(rejectedBottles) || rejectedBottles < 0) {
      return {
        success: false,
        error: "La cantidad de botellas rechazadas no es válida.",
      };
    }

    if (rejectedBottles > filledBottles) {
      return {
        success: false,
        error:
          "Las botellas rechazadas no pueden superar las botellas llenadas.",
      };
    }

    const producedBottles = filledBottles - rejectedBottles;

    if (producedBottles <= 0) {
      return {
        success: false,
        error: "Debe existir al menos una botella disponible al finalizar.",
      };
    }

    const bottleLiters = bottleSizeMl / 1000;
    const litersUsed = roundLiters(filledBottles * bottleLiters);
    const lossLiters = roundLiters(rejectedBottles * bottleLiters);

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

          product: {
            select: {
              id: true,
              prefix: true,
            },
          },

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

      const canBottle =
        batch.status === LiquorBatchStatus.LISTO_PARA_EMBOTELLAR ||
        batch.status === LiquorBatchStatus.EMBOTELLANDO;

      if (!canBottle) {
        throw new Error(
          "Este lote no se encuentra liberado para embotellado."
        );
      }

      const batchLiters = batch.actualLiters ?? batch.plannedLiters;

      if (!Number.isFinite(batchLiters) || batchLiters <= 0) {
        throw new Error(
          "El lote no tiene un volumen válido registrado para embotellar."
        );
      }

      const alreadyUsedLiters = roundLiters(
        batch.bottlings.reduce(
          (total, bottling) => total + (bottling.litersUsed ?? 0),
          0
        )
      );

      const availableLiters = roundLiters(
        Math.max(batchLiters - alreadyUsedLiters, 0)
      );

      if (litersUsed > availableLiters + 0.0001) {
        throw new Error(
          `El embotellado requiere ${formatLiters(
            litersUsed
          )} L, pero solamente quedan ${formatLiters(availableLiters)} L.`
        );
      }

      const now = new Date();
      const bottlingCode = createBottlingCode(batch.code);
      const productPrefix = sanitizeProductPrefix(batch.product.prefix);

      /*
       * Buscamos todos los códigos de botella del mismo producto para
       * continuar el consecutivo, aunque se realicen varios embotellados.
       */
      const existingBottleCodes = await tx.liquorBottle.findMany({
        where: {
          bottling: {
            batch: {
              productId: batch.product.id,
            },
          },
        },
        select: {
          code: true,
        },
      });

      const lastVisibleSequence = getHighestBottleSequence(
        existingBottleCodes.map((bottle) => bottle.code),
        productPrefix
      );

      const bottling = await tx.liquorBottling.create({
        data: {
          code: bottlingCode,
          batchId: batch.id,
          status: LiquorBottlingStatus.TERMINADO,
          bottleSizeMl,
          plannedBottles: filledBottles,
          producedBottles,
          rejectedBottles,
          litersUsed,
          lossLiters,
          bottledAt: now,
          startedAt: now,
          finishedAt: now,
          notes,
          createdById: userId,
          finishedById: userId,
        },
        select: {
          id: true,
          code: true,
        },
      });

      const bottles = Array.from(
        {
          length: producedBottles,
        },
        (_, index) => {
          /*
           * serialNumber conserva el orden interno dentro del embotellado.
           * visibleSequence es el consecutivo global del producto.
           */
          const serialNumber = index + 1;
          const visibleSequence = lastVisibleSequence + index + 1;

          return {
            bottlingId: bottling.id,
            code: createBottleCode(productPrefix, visibleSequence),
            serialNumber,
            qrToken: randomUUID(),
            status: LiquorBottleStatus.DISPONIBLE,
            bottledAt: now,
            expirationDate: null,
            currentLocation: "Almacén principal",
          };
        }
      );

      await tx.liquorBottle.createMany({
        data: bottles,
      });

      const remainingLiters = roundLiters(
        Math.max(availableLiters - litersUsed, 0)
      );

      await tx.liquorBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status:
            remainingLiters <= 0.0001
              ? LiquorBatchStatus.TERMINADO
              : LiquorBatchStatus.EMBOTELLANDO,
        },
      });

      return {
        bottlingId: bottling.id,
        bottlingCode: bottling.code,
        producedBottles,
        rejectedBottles,
        litersUsed,
        lossLiters,
        remainingLiters,
      };
    });

    revalidatePath(`/liquors/batches/${batchId}`);
    revalidatePath(`/liquors/batches/${batchId}/bottling`);
    revalidatePath("/liquors/bottling");
    revalidatePath("/liquors/inventory");

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error("Error al crear el embotellado:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible guardar el embotellado.",
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

/**
 * Código interno del proceso de embotellado.
 * No se utiliza como código visible en la etiqueta.
 */
function createBottlingCode(batchCode: string) {
  const cleanBatchCode = sanitizeCode(batchCode);
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `EMB-${cleanBatchCode}-${timestamp}-${suffix}`;
}

/**
 * Código corto y visible de cada botella.
 *
 * Ejemplos:
 * LZ-000001
 * LM-000025
 * GRAN-000104
 */
function createBottleCode(
  productPrefix: string,
  sequence: number
) {
  const formattedSequence = sequence
    .toString()
    .padStart(6, "0");

  return `${productPrefix}-${formattedSequence}`;
}

/**
 * Obtiene el consecutivo más alto utilizado para el producto.
 *
 * Ignora los códigos antiguos largos, ya que no cumplen con el nuevo
 * formato PREFIJO-000001.
 */
function getHighestBottleSequence(
  existingCodes: string[],
  productPrefix: string
) {
  const escapedPrefix = escapeRegularExpression(productPrefix);

  const bottleCodePattern = new RegExp(
    `^${escapedPrefix}-(\\d{6,})$`,
    "i"
  );

  let highestSequence = 0;

  for (const code of existingCodes) {
    const match = code.match(bottleCodePattern);

    if (!match) {
      continue;
    }

    const sequence = Number(match[1]);

    if (
      Number.isSafeInteger(sequence) &&
      sequence > highestSequence
    ) {
      highestSequence = sequence;
    }
  }

  return highestSequence;
}

function sanitizeProductPrefix(value: string) {
  const prefix = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);

  if (!prefix) {
    throw new Error(
      "El producto no tiene un prefijo válido para generar las botellas."
    );
  }

  return prefix;
}

function sanitizeCode(value: string) {
  const sanitized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "LOTE";
}

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundLiters(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatLiters(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 3,
  }).format(value);
}