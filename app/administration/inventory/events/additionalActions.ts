"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireModuleActionAccess } from "@/lib/auth";
import { baseContent } from "@/lib/inventory/presentation";
import { normalizeManualInventoryQuantity } from "@/lib/inventory/manualMovements";
import { getNormalizedContentPerUnit } from "@/lib/inventory/units";
import { recordEventAdditionalMovement } from "@/lib/inventory/eventAdditionalMovements";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { generateOperationId } from "@/lib/pos2/operationId";

class EventInputError extends Error {}

function normalizedFactor(product: Parameters<typeof normalizeManualInventoryQuantity>[0]) {
  if (product.inventoryBaseUnit) {
    try {
      return normalizeManualInventoryQuantity(product, 1);
    } catch {
      const presentationFactor = getNormalizedContentPerUnit(product);
      if (presentationFactor !== null && product.handlingUnit) {
        return new Prisma.Decimal(presentationFactor);
      }
      throw new EventInputError("Configura la unidad y presentación del producto antes de cargarlo al evento.");
    }
  }
  return new Prisma.Decimal(baseContent({
    handlingUnit: product.handlingUnit,
    contentPerUnit: product.contentPerUnit === null ? null : Number(product.contentPerUnit),
    contentUnit: product.contentUnit,
  }) ?? 1);
}

function readQuantity(value: string, allowZero = false) {
  const raw = value.trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) {
    throw new EventInputError("Captura una cantidad válida con hasta tres decimales.");
  }
  const quantity = new Prisma.Decimal(raw);
  if ((!allowZero && quantity.isZero()) || quantity.gt("999999999.999")) {
    throw new EventInputError("La cantidad debe ser mayor a cero y estar dentro del límite permitido.");
  }
  return quantity;
}

async function requireBranchAccess(tx: Prisma.TransactionClient, user: { id: string; role: string }, branchId: string) {
  const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { active: true } });
  if (!branch?.active) throw new EventInputError("Selecciona una sucursal activa.");
  if (user.role !== "ADMIN" && !await tx.userBranch.findFirst({ where: { userId: user.id, branchId } })) {
    throw new EventInputError("No tienes acceso a esa sucursal.");
  }
}

function actionError(error: unknown, fallback: string) {
  if (error instanceof EventInputError) return error.message;
  console.error(fallback, error);
  return fallback;
}

export type AdditionalActionResult =
  | { success: true; message: string; id?: string; nextOperationId: string }
  | { success: false; error: string };

export async function addEventSupplyAction(input: {
  eventId: string;
  productId: string;
  sourceBranchId: string;
  quantity: string;
  notes: string;
  operationId: string;
}): Promise<AdditionalActionResult> {
  try {
    const user = await requireModuleActionAccess("/administration/inventory/events");
    const quantity = readQuantity(input.quantity);
    const notes = input.notes.trim().slice(0, 500);
    const { result } = await executeIdempotent({
      operationId: input.operationId,
      command: "AddEventSupply",
      payload: { eventId: input.eventId, productId: input.productId, sourceBranchId: input.sourceBranchId, quantity: quantity.toString(), notes },
      receiptContext: { actorId: user.id, branchId: input.sourceBranchId },
      execute: async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceEvent" WHERE "id"=${input.eventId} FOR UPDATE`;
        const event = await tx.serviceEvent.findUnique({ where: { id: input.eventId } });
        if (!event || !event.checkoutConfirmedAt || event.returnConfirmedAt || event.status === "CANCELLED") {
          throw new EventInputError("El evento debe tener la salida confirmada y el regreso pendiente.");
        }
        await requireBranchAccess(tx, user, input.sourceBranchId);
        await tx.$queryRaw`SELECT "id" FROM "InventoryProduct" WHERE "id"=${input.productId} FOR UPDATE`;
        const product = await tx.inventoryProduct.findUnique({ where: { id: input.productId } });
        if (!product?.isActive || product.archivedAt || !product.trackStock) {
          throw new EventInputError("Selecciona un producto activo con seguimiento de stock.");
        }
        const factor = normalizedFactor(product);
        const normalizedQuantity = quantity.times(factor);
        if (normalizedQuantity.gt("99999999999.999")) {
          throw new EventInputError("La cantidad supera el límite permitido para esta presentación.");
        }
        const unitCost = product.unitCost;
        const addition = await tx.eventAddedProduct.create({
          data: {
            eventId: event.id,
            productId: product.id,
            sourceType: "ENVIO_SUCURSAL",
            sourceBranchId: input.sourceBranchId,
            quantityOriginal: quantity,
            handlingUnit: product.handlingUnit,
            contentPerUnit: product.contentPerUnit,
            contentUnit: product.contentUnit,
            normalizedQuantity,
            unitCost,
            totalCost: unitCost === null ? null : new Prisma.Decimal(unitCost).times(quantity).toDecimalPlaces(2),
            notes: notes || null,
            addedById: user.id,
          },
        });
        const movementId = await recordEventAdditionalMovement(tx, {
          addition, product, branchId: input.sourceBranchId, actorId: user.id,
          operationId: input.operationId, returning: false,
        });
        await tx.eventAddedProduct.update({ where: { id: addition.id }, data: { movementId } });
        return { type: "EventAddedProduct", id: addition.id };
      },
    });
    revalidatePath(`/administration/inventory/events/${input.eventId}`);
    return { success: true, message: "Carga adicional registrada.", id: String(result.id), nextOperationId: generateOperationId() };
  } catch (error) {
    return { success: false, error: actionError(error, "No fue posible registrar la carga adicional.") };
  }
}

export async function captureEventSupplyReturnAction(input: {
  eventId: string;
  additionId: string;
  returnedQuantity: string;
  returnedOpenQuantity: string;
  operationId: string;
}): Promise<AdditionalActionResult> {
  try {
    const user = await requireModuleActionAccess("/administration/inventory/events");
    const returned = readQuantity(input.returnedQuantity, true);
    const open = readQuantity(input.returnedOpenQuantity || "0", true);
    const { result } = await executeIdempotent({
      operationId: input.operationId,
      command: "CaptureEventSupplyReturn",
      payload: { eventId: input.eventId, additionId: input.additionId, returned: returned.toString(), open: open.toString() },
      receiptContext: { actorId: user.id },
      execute: async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceEvent" WHERE "id"=${input.eventId} FOR UPDATE`;
        const event = await tx.serviceEvent.findUnique({ where: { id: input.eventId } });
        if (!event?.checkoutConfirmedAt || event.returnConfirmedAt || event.status === "CANCELLED") {
          throw new EventInputError("El regreso de este evento ya no está abierto.");
        }
        const addition = await tx.eventAddedProduct.findFirst({
          where: { id: input.additionId, eventId: input.eventId, status: "ACTIVO", sourceType: "ENVIO_SUCURSAL" },
        });
        if (!addition?.sourceBranchId) throw new EventInputError("La carga adicional no pertenece a este evento.");
        await requireBranchAccess(tx, user, addition.sourceBranchId);
        const factor = new Prisma.Decimal(addition.normalizedQuantity).div(addition.quantityOriginal);
        if (open.gt(0) && (!addition.contentPerUnit || open.gte(factor))) {
          throw new EventInputError("El remanente abierto debe ser menor a una presentación.");
        }
        if (returned.plus(open.div(factor)).gt(addition.quantityOriginal)) {
          throw new EventInputError("Lo regresado no puede superar la carga adicional.");
        }
        const changed = addition.returnBranchId === null
          || !new Prisma.Decimal(addition.returnedQuantity).eq(returned)
          || !new Prisma.Decimal(addition.returnedOpenQuantity ?? 0).eq(open);
        if (changed) {
          await tx.eventAddedProduct.update({
            where: { id: addition.id },
            data: {
              returnedQuantity: returned,
              returnedOpenQuantity: open,
              returnBranchId: addition.sourceBranchId,
            },
          });
          await tx.eventAddedProductLog.create({
            data: {
              addedProductId: addition.id,
              field: "returnCapture",
              oldValue: addition.returnBranchId === null ? null : `${addition.returnedQuantity}/${addition.returnedOpenQuantity ?? 0}`,
              newValue: `${returned}/${open}`,
              changedById: user.id,
            },
          });
        }
        return { type: "EventAddedProductReturn", id: addition.id };
      },
    });
    revalidatePath(`/administration/inventory/events/${input.eventId}`);
    return { success: true, message: "Regreso adicional capturado.", id: String(result.id), nextOperationId: generateOperationId() };
  } catch (error) {
    return { success: false, error: actionError(error, "No fue posible capturar el regreso adicional.") };
  }
}
