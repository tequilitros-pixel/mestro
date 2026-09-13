"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  LiquorBottleStatus,
  LiquorBottlingStatus,
  RawMaterialMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyMovement } from "./rawMaterials";

/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Embotellado directo desde materia prima a granel.
 *
 * El tequila blanco sale del proceso de agave, no de una receta:
 * por eso se embotella desde su existencia a granel y no desde un
 * LiquorBatch. Genera botellas con folio y QR igual que los
 * licores, pero la configuración de etiquetado vive en la ficha
 * de la materia prima.
 *
 * El producto embotellado se queda en el almacén de planta. Para
 * mandarlo a una sucursal se usa el traspaso, que es un paso
 * aparte y deliberado.
 * ==========================================================
 */

export type ActionResult =
  | { success: true; message: string; bottlingId: string }
  | { success: false; error: string };

const ROLES_QUE_PUEDEN_EMBOTELLAR = ["ADMIN", "GERENTE"];

export async function bottleFromRawMaterialAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) return { success: false, error: "No autorizado" };

  if (!ROLES_QUE_PUEDEN_EMBOTELLAR.includes(user.role)) {
    return {
      success: false,
      error: "Solo un administrador o gerente puede embotellar.",
    };
  }

  const rawMaterialId = String(formData.get("rawMaterialId") ?? "").trim();
  const bottleSizeMl = Number(formData.get("bottleSizeMl"));
  const producedBottles = Number(formData.get("producedBottles"));
  const lossLiters = Number(formData.get("lossLiters") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!rawMaterialId) {
    return { success: false, error: "Selecciona la materia prima a embotellar." };
  }

  if (!Number.isFinite(bottleSizeMl) || bottleSizeMl <= 0) {
    return { success: false, error: "La presentación debe ser mayor que cero." };
  }

  if (!Number.isInteger(producedBottles) || producedBottles <= 0) {
    return { success: false, error: "El número de botellas debe ser un entero mayor que cero." };
  }

  if (lossLiters < 0) {
    return { success: false, error: "La merma no puede ser negativa." };
  }

  const material = await prisma.rawMaterial.findUnique({
    where: { id: rawMaterialId },
    select: {
      id: true,
      code: true,
      name: true,
      baseUnit: true,
      currentStock: true,
      bottleable: true,
      bottlePrefix: true,
      defaultShelfLifeDays: true,
      yellowAlertDays: true,
      redAlertDays: true,
      showExpirationOnLabel: true,
    },
  });

  if (!material) {
    return { success: false, error: "La materia prima ya no existe." };
  }

  if (!material.bottleable) {
    return {
      success: false,
      error: `${material.name} no está habilitada para embotellar. Actívalo en su ficha.`,
    };
  }

  const prefix = sanitizePrefix(material.bottlePrefix ?? "");

  if (!prefix) {
    return {
      success: false,
      error: `${material.name} no tiene prefijo de folio configurado. Captúralo en su ficha para poder generar los códigos de botella.`,
    };
  }

  // La existencia se lleva en la unidad base del material. Solo tiene
  // sentido embotellar algo medido en litros.
  const unit = material.baseUnit.trim().toLowerCase();

  if (unit !== "l" && unit !== "lt" && unit !== "litro" && unit !== "litros") {
    return {
      success: false,
      error: `${material.name} se mide en "${material.baseUnit}". Para embotellar, la unidad base debe ser litros.`,
    };
  }

  const litersUsed = (producedBottles * bottleSizeMl) / 1000 + lossLiters;

  if (material.currentStock < litersUsed) {
    return {
      success: false,
      error: `No alcanza: se necesitan ${litersUsed.toFixed(3)} L (incluyendo merma) y solo hay ${material.currentStock.toFixed(3)} L de ${material.name}.`,
    };
  }

  const now = new Date();

  const expirationDate =
    material.defaultShelfLifeDays && material.defaultShelfLifeDays > 0
      ? new Date(now.getTime() + material.defaultShelfLifeDays * 86_400_000)
      : null;

  try {
    const bottlingId = await prisma.$transaction(async (tx) => {
      /*
       * Consecutivo por prefijo. Se lee dentro de la transacción para
       * reducir el riesgo de que dos embotellados simultáneos generen
       * el mismo folio; el índice único de `code` es la red final.
       */
      const existing = await tx.liquorBottle.findMany({
        where: { code: { startsWith: `${prefix}-` } },
        select: { code: true },
      });

      let sequence = highestSequence(
        existing.map((b) => b.code),
        prefix,
      );

      const bottling = await tx.liquorBottling.create({
        data: {
          code: buildBottlingCode(material.code),
          rawMaterialId: material.id,
          status: LiquorBottlingStatus.TERMINADO,
          bottleSizeMl: Math.trunc(bottleSizeMl),
          plannedBottles: producedBottles,
          producedBottles,
          litersUsed,
          lossLiters,
          bottledAt: now,
          expirationDate,
          startedAt: now,
          finishedAt: now,
          notes,
          createdById: user.id,
          finishedById: user.id,
        },
        select: { id: true, code: true },
      });

      const bottles = Array.from({ length: producedBottles }, () => {
        sequence += 1;

        return {
          bottlingId: bottling.id,
          code: `${prefix}-${String(sequence).padStart(6, "0")}`,
          serialNumber: sequence,
          authenticityCode: buildAuthenticityCode(),
          status: LiquorBottleStatus.DISPONIBLE,
          manufacturedAt: now,
          bottledAt: now,
          expirationDate,
          shelfLifeDays: material.defaultShelfLifeDays,
          yellowAlertDays: material.yellowAlertDays,
          redAlertDays: material.redAlertDays,
          showExpirationOnLabel: material.showExpirationOnLabel,
          currentLocation: "Almacén de planta",
        };
      });

      await tx.liquorBottle.createMany({ data: bottles });

      // Sale del granel: lo embotellado más la merma declarada.
      await applyMovement(tx, {
        rawMaterialId: material.id,
        type: RawMaterialMovementType.CONSUMO_RECETA,
        amount: litersUsed,
        createdById: user.id,
        notes: `Embotellado ${bottling.code} · ${producedBottles} botellas de ${bottleSizeMl} ml${
          lossLiters > 0 ? ` · merma ${lossLiters} L` : ""
        }.`,
      });

      return bottling.id;
    });

    revalidatePath("/liquors/raw-materials");
    revalidatePath("/liquors/inventory");

    return {
      success: true,
      bottlingId,
      message: `${producedBottles} botellas de ${bottleSizeMl} ml generadas. Quedan en el almacén de planta; usa Traspaso para enviarlas a una sucursal.`,
    };
  } catch (error) {
    console.error("Error bottling from raw material:", error);
    return { success: false, error: "No fue posible completar el embotellado." };
  }
}

function sanitizePrefix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
}

function buildBottlingCode(materialCode: string) {
  const clean = materialCode.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();

  return `EMB-${clean || "GRANEL"}-${stamp}-${suffix}`;
}

function buildAuthenticityCode() {
  const a = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  const b = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();

  return `${a}-${b}`;
}

function highestSequence(codes: string[], prefix: string) {
  const pattern = new RegExp(`^${prefix}-(\\d{6,})$`, "i");
  let highest = 0;

  for (const code of codes) {
    const match = code.match(pattern);
    if (!match) continue;

    const value = Number(match[1]);
    if (Number.isSafeInteger(value) && value > highest) highest = value;
  }

  return highest;
}
