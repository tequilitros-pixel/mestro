"use server";

import { revalidatePath } from "next/cache";
import { Prisma, RawMaterialMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Almacén de materia prima para elaboración de licores.
 *
 * Regla central: `RawMaterial.currentStock` NUNCA se edita a mano.
 * Todo cambio pasa por `applyMovement`, que registra el movimiento
 * y ajusta el stock en la misma transacción. Así siempre existe el
 * rastro de por qué cambió una existencia.
 *
 * Signo de las cantidades: entradas en positivo (compra,
 * producción), salidas en negativo (consumo de receta, merma,
 * traspaso). El ajuste puede ir en cualquier sentido.
 * ==========================================================
 */

export type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const ROLES_QUE_PUEDEN_MOVER = ["ADMIN", "GERENTE"];

/** Movimientos que siempre restan, sin importar el signo capturado. */
const OUTGOING: RawMaterialMovementType[] = [
  RawMaterialMovementType.CONSUMO_RECETA,
  RawMaterialMovementType.MERMA,
  RawMaterialMovementType.TRASPASO_SUCURSAL,
];

async function requireStockRole() {
  const user = await getCurrentUser();

  if (!user) return { error: "No autorizado" as const, user: null };

  if (!ROLES_QUE_PUEDEN_MOVER.includes(user.role)) {
    return {
      error: "Solo un administrador o gerente puede mover materia prima" as const,
      user: null,
    };
  }

  return { error: null, user };
}

/**
 * Aplica un movimiento y deja el stock consistente.
 *
 * Recibe el cliente de Prisma (o una transacción) para poder usarse
 * tanto desde acciones sueltas como desde procesos más grandes, como
 * el descuento automático al completar un ingrediente.
 */
export async function applyMovement(
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    rawMaterialId: string;
    type: RawMaterialMovementType;
    /** Siempre en positivo: el signo lo decide el tipo. */
    amount: number;
    unitCost?: number | null;
    lotId?: string | null;
    liquorBatchId?: string | null;
    branchId?: string | null;
    notes?: string | null;
    createdById?: string | null;
    /** Para AJUSTE: indica si suma o resta. */
    negative?: boolean;
  },
) {
  const magnitude = Math.abs(input.amount);

  const isOutgoing =
    OUTGOING.includes(input.type) ||
    (input.type === RawMaterialMovementType.AJUSTE && input.negative === true);

  const signed = isOutgoing ? -magnitude : magnitude;

  const material = await client.rawMaterial.findUnique({
    where: { id: input.rawMaterialId },
    select: { currentStock: true, averageCost: true },
  });

  if (!material) {
    throw new Error("La materia prima ya no existe.");
  }

  /*
   * Costo promedio ponderado: solo lo recalculan las entradas que
   * traen costo. Las salidas consumen al promedio vigente, así que
   * no lo modifican.
   */
  let averageCost = material.averageCost;

  if (!isOutgoing && input.unitCost != null && input.unitCost >= 0) {
    const previousStock = Math.max(material.currentStock, 0);
    const previousValue = previousStock * (material.averageCost ?? input.unitCost);
    const incomingValue = magnitude * input.unitCost;
    const totalStock = previousStock + magnitude;

    averageCost =
      totalStock > 0 ? (previousValue + incomingValue) / totalStock : input.unitCost;
  }

  await client.rawMaterialMovement.create({
    data: {
      rawMaterialId: input.rawMaterialId,
      type: input.type,
      quantity: signed,
      unitCost: input.unitCost ?? null,
      lotId: input.lotId ?? null,
      liquorBatchId: input.liquorBatchId ?? null,
      branchId: input.branchId ?? null,
      notes: input.notes ?? null,
      createdById: input.createdById ?? null,
    },
  });

  await client.rawMaterial.update({
    where: { id: input.rawMaterialId },
    data: {
      currentStock: { increment: signed },
      ...(averageCost !== material.averageCost ? { averageCost } : {}),
    },
  });
}

function readNumber(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (raw === null || String(raw).trim() === "") return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function createRawMaterialAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStockRole();
  if (auth.error) return { success: false, error: auth.error };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const baseUnit = String(formData.get("baseUnit") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const minimumStock = readNumber(formData, "minimumStock") ?? 0;

  if (!code) return { success: false, error: "El código es obligatorio." };
  if (!name) return { success: false, error: "El nombre es obligatorio." };
  if (!baseUnit) return { success: false, error: "La unidad base es obligatoria." };
  if (minimumStock < 0) {
    return { success: false, error: "La existencia mínima no puede ser negativa." };
  }

  try {
    const duplicate = await prisma.rawMaterial.findFirst({
      where: { OR: [{ code }, { name }] },
      select: { code: true, name: true },
    });

    if (duplicate) {
      return {
        success: false,
        error:
          duplicate.code === code
            ? `Ya existe una materia prima con el código ${code}.`
            : `Ya existe una materia prima llamada ${name}.`,
      };
    }

    await prisma.rawMaterial.create({
      data: { code, name, baseUnit, category, minimumStock, currentStock: 0 },
    });

    revalidatePath("/liquors/raw-materials");

    return { success: true, message: "Materia prima creada." };
  } catch (error) {
    console.error("Error creating raw material:", error);
    return { success: false, error: "No fue posible crear la materia prima." };
  }
}

export async function updateRawMaterialAction(
  materialId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStockRole();
  if (auth.error) return { success: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  const baseUnit = String(formData.get("baseUnit") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const minimumStock = readNumber(formData, "minimumStock") ?? 0;
  const active = formData.get("active") === "on";

  // Configuración de embotellado (solo aplica al granel embotellable,
  // como el tequila que sale del proceso).
  const bottleable = formData.get("bottleable") === "on";
  const bottlePrefix =
    String(formData.get("bottlePrefix") ?? "").trim().toUpperCase() || null;
  const defaultShelfLifeDays = readNumber(formData, "defaultShelfLifeDays");
  const yellowAlertDays = readNumber(formData, "yellowAlertDays");
  const redAlertDays = readNumber(formData, "redAlertDays");
  const showExpirationOnLabel = formData.get("showExpirationOnLabel") === "on";
  const inventoryProductId =
    String(formData.get("inventoryProductId") ?? "").trim() || null;

  if (!name) return { success: false, error: "El nombre es obligatorio." };
  if (!baseUnit) return { success: false, error: "La unidad base es obligatoria." };
  if (minimumStock < 0) {
    return { success: false, error: "La existencia mínima no puede ser negativa." };
  }

  /*
   * Si se habilita el embotellado, la configuración de etiquetado debe
   * quedar completa: sin prefijo no se pueden generar folios, y las
   * alertas mal ordenadas darían avisos de caducidad sin sentido.
   */
  if (bottleable) {
    if (!bottlePrefix) {
      return {
        success: false,
        error: "Para embotellar hace falta un prefijo de folio (ej. TQB).",
      };
    }

    if (defaultShelfLifeDays === null || defaultShelfLifeDays <= 0) {
      return {
        success: false,
        error: "Para embotellar hace falta la vida útil en días.",
      };
    }

    if (
      yellowAlertDays !== null &&
      (yellowAlertDays <= 0 || yellowAlertDays > defaultShelfLifeDays)
    ) {
      return {
        success: false,
        error: "La alerta amarilla debe estar entre 1 día y la vida útil.",
      };
    }

    if (
      redAlertDays !== null &&
      yellowAlertDays !== null &&
      (redAlertDays <= 0 || redAlertDays > yellowAlertDays)
    ) {
      return {
        success: false,
        error: "La alerta roja debe ser menor o igual que la amarilla.",
      };
    }
  }

  try {
    await prisma.rawMaterial.update({
      where: { id: materialId },
      data: {
        name,
        baseUnit,
        category,
        minimumStock,
        active,
        bottleable,
        bottlePrefix,
        defaultShelfLifeDays:
          defaultShelfLifeDays !== null ? Math.trunc(defaultShelfLifeDays) : null,
        yellowAlertDays:
          yellowAlertDays !== null ? Math.trunc(yellowAlertDays) : null,
        redAlertDays: redAlertDays !== null ? Math.trunc(redAlertDays) : null,
        showExpirationOnLabel,
        inventoryProductId,
      },
    });

    revalidatePath("/liquors/raw-materials");

    return { success: true, message: "Materia prima actualizada." };
  } catch (error) {
    console.error("Error updating raw material:", error);
    return { success: false, error: "No fue posible actualizar la materia prima." };
  }
}

/** Registra una compra, un ajuste o una merma. */
export async function registerMovementAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStockRole();
  if (auth.error || !auth.user) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const rawMaterialId = String(formData.get("rawMaterialId") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim();
  const amount = readNumber(formData, "amount");
  const unitCost = readNumber(formData, "unitCost");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const negative = formData.get("negative") === "on";

  if (!rawMaterialId) {
    return { success: false, error: "Selecciona la materia prima." };
  }

  const allowed: RawMaterialMovementType[] = [
    RawMaterialMovementType.COMPRA,
    RawMaterialMovementType.AJUSTE,
    RawMaterialMovementType.MERMA,
  ];

  if (!allowed.includes(typeValue as RawMaterialMovementType)) {
    return { success: false, error: "Tipo de movimiento no válido." };
  }

  if (amount === null || amount <= 0) {
    return { success: false, error: "La cantidad debe ser mayor que cero." };
  }

  if (unitCost !== null && unitCost < 0) {
    return { success: false, error: "El costo unitario no puede ser negativo." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        rawMaterialId,
        type: typeValue as RawMaterialMovementType,
        amount,
        unitCost,
        notes,
        negative,
        createdById: auth.user!.id,
      });
    });

    revalidatePath("/liquors/raw-materials");

    return { success: true, message: "Movimiento registrado." };
  } catch (error) {
    console.error("Error registering raw material movement:", error);
    return { success: false, error: "No fue posible registrar el movimiento." };
  }
}

/**
 * Traspasa materia prima a una sucursal. Sale del almacén de
 * producción y, si el material tiene un producto de inventario
 * equivalente, entra al stock de esa sucursal.
 */
export async function transferToBranchAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStockRole();
  if (auth.error || !auth.user) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const rawMaterialId = String(formData.get("rawMaterialId") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const inventoryProductId =
    String(formData.get("inventoryProductId") ?? "").trim() || null;
  const amount = readNumber(formData, "amount");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!rawMaterialId || !branchId) {
    return { success: false, error: "Selecciona la materia prima y la sucursal." };
  }

  if (amount === null || amount <= 0) {
    return { success: false, error: "La cantidad debe ser mayor que cero." };
  }

  try {
    const material = await prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      select: { name: true, currentStock: true, baseUnit: true },
    });

    if (!material) {
      return { success: false, error: "La materia prima ya no existe." };
    }

    if (material.currentStock < amount) {
      return {
        success: false,
        error: `Solo hay ${material.currentStock} ${material.baseUnit} disponibles de ${material.name}.`,
      };
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    if (!branch) {
      return { success: false, error: "La sucursal ya no existe." };
    }

    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        rawMaterialId,
        type: RawMaterialMovementType.TRASPASO_SUCURSAL,
        amount,
        branchId,
        notes: notes ?? `Traspaso a ${branch.name}.`,
        createdById: auth.user!.id,
      });

      // Espejo en el inventario de sucursales, para que el stock que
      // consume el Punto de Venta refleje lo que se envió.
      if (inventoryProductId) {
        await tx.inventoryEntry.create({
          data: {
            branchId,
            productId: inventoryProductId,
            type: "TRASPASO",
            quantity: amount,
            notes: `Traspaso desde almacén de producción · ${material.name}.`,
          },
        });
      }
    });

    revalidatePath("/liquors/raw-materials");
    revalidatePath("/administration/inventory/sucursales");

    return {
      success: true,
      message: inventoryProductId
        ? `Traspaso a ${branch.name} registrado en ambos inventarios.`
        : `Traspaso a ${branch.name} registrado. El material no tiene producto de inventario vinculado, así que no se abonó al stock de la sucursal.`,
    };
  } catch (error) {
    console.error("Error transferring raw material:", error);
    return { success: false, error: "No fue posible registrar el traspaso." };
  }
}

/** Marca cuál material recibe el destilado de los lotes de agave. */
export async function setLotOutputMaterialAction(
  materialId: string,
): Promise<ActionResult> {
  const auth = await requireStockRole();
  if (auth.error) return { success: false, error: auth.error };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rawMaterial.updateMany({
        where: { receivesLotOutput: true },
        data: { receivesLotOutput: false },
      });

      await tx.rawMaterial.update({
        where: { id: materialId },
        data: { receivesLotOutput: true },
      });
    });

    revalidatePath("/liquors/raw-materials");

    return {
      success: true,
      message: "Este material recibirá el destilado de los lotes al cerrarlos.",
    };
  } catch (error) {
    console.error("Error setting lot output material:", error);
    return { success: false, error: "No fue posible actualizar la configuración." };
  }
}
