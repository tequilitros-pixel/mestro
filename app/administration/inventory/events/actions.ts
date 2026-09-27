"use server";

import { revalidatePath } from "next/cache";
import { applyEventInventoryMovement } from "@/lib/inventory/eventMovements";
import { generateOperationId } from "@/lib/pos2/operationId";
import { prisma } from "@/lib/prisma";
import { type Prisma, ServiceEventStatus } from "@prisma/client";
import { requireModuleActionAccess } from "@/lib/auth";
import { parseBusinessDateTimeLocal } from "@/lib/dateTime";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

async function getEventActor() {
  try {
    return await requireModuleActionAccess("/administration/inventory/events");
  } catch {
    return null;
  }
}

async function lockEvent(tx: Prisma.TransactionClient, eventId: string) {
  await tx.$queryRaw`SELECT "id" FROM "ServiceEvent" WHERE "id"=${eventId} FOR UPDATE`;
  const event = await tx.serviceEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Evento no encontrado.");
  if (event.status === "CANCELLED") throw new Error("El evento está cancelado.");
  return event;
}

function readOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value.toString().trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculatePackageItemQuantity(
  item: { quantity: unknown; calculationType: string; guestsPerBlock: number | null },
  guestCount: number,
): number {
  const baseQuantity = Number(item.quantity);

  switch (item.calculationType) {
    case "PER_GUEST":
      return baseQuantity * guestCount;
    case "PER_GUEST_BLOCK": {
      const block = item.guestsPerBlock ?? 1;
      const blocks = Math.ceil(guestCount / block);
      return baseQuantity * blocks;
    }
    case "MANUAL":
    case "FIXED":
    default:
      return baseQuantity;
  }
}

export async function createServiceEventAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    const clientName = formData.get("clientName")?.toString().trim() ?? "";
    const clientPhone = formData.get("clientPhone")?.toString().trim() || null;
    const location = formData.get("location")?.toString().trim() ?? "";
    const eventDateRaw = formData.get("eventDate")?.toString() ?? "";
    const guestCount = readOptionalNumber(formData.get("guestCount"));
    const packageId = formData.get("packageId")?.toString() || null;
    const equipmentKitId = formData.get("equipmentKitId")?.toString() || null;
    const saleAmount = readOptionalNumber(formData.get("saleAmount"));

    if (!clientName) {
      return { success: false, error: "El nombre del cliente es obligatorio." };
    }

    if (!location) {
      return { success: false, error: "La ubicación es obligatoria." };
    }

    if (!eventDateRaw) {
      return { success: false, error: "La fecha del evento es obligatoria." };
    }

    if (guestCount === null || guestCount <= 0) {
      return { success: false, error: "El número de invitados debe ser mayor a cero." };
    }

    let eventDate: Date;
    try {
      eventDate = parseBusinessDateTimeLocal(eventDateRaw);
    } catch {
      return { success: false, error: "La fecha del evento no es válida." };
    }

    const guests = Math.trunc(guestCount);
    const code = `EVT-${Date.now()}`;

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceEvent.create({
        data: {
          code,
          clientName,
          clientPhone,
          location,
          eventDate,
          guestCount: guests,
          saleAmount,
          packageId,
          equipmentKitId,
          status: "DRAFT",
        },
        select: { id: true },
      });

      let sortOrder = 0;

      if (packageId) {
        const packageItems = await tx.eventPackageItem.findMany({
          where: { packageId },
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        });

        for (const item of packageItems) {
          const quantity = calculatePackageItemQuantity(item, guests);

          await tx.serviceEventItem.create({
            data: {
              eventId: created.id,
              productId: item.productId,
              productName: item.product.name,
              unit: item.product.unit,
              itemType: item.product.itemType,
              unitCost: item.product.unitCost,
              handlingUnit: item.product.handlingUnit,
              contentPerUnit: item.product.contentPerUnit,
              contentUnit: item.product.contentUnit,
              plannedQuantity: quantity,
              isCustom: false,
              sortOrder: sortOrder++,
            },
          });
        }
      }

      if (equipmentKitId) {
        const kitItems = await tx.equipmentKitItem.findMany({
          where: { kitId: equipmentKitId },
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        });

        for (const item of kitItems) {
          await tx.serviceEventItem.create({
            data: {
              eventId: created.id,
              productId: item.productId,
              productName: item.product.name,
              unit: item.product.unit,
              itemType: item.product.itemType,
              unitCost: item.product.unitCost,
              handlingUnit: item.product.handlingUnit,
              contentPerUnit: item.product.contentPerUnit,
              contentUnit: item.product.contentUnit,
              plannedQuantity: item.quantity,
              isCustom: false,
              sortOrder: sortOrder++,
            },
          });
        }
      }

      return created;
    });

    revalidatePath("/administration/inventory/events");

    return { success: true, message: "Evento creado correctamente.", id: event.id };
  } catch (error) {
    console.error("Error creating service event:", error);
    return { success: false, error: "No fue posible crear el evento." };
  }
}

export async function updateSentQuantityAction(
  itemId: string,
  eventId: string,
  sentQuantity: number,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    if (!Number.isFinite(sentQuantity) || sentQuantity < 0) {
      return { success: false, error: "La cantidad no puede ser negativa." };
    }

    await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (event.checkoutConfirmedAt || event.stockDeductedAt || event.returnConfirmedAt) throw new Error("La salida ya fue confirmada.");
      const item = await tx.serviceEventItem.findFirst({ where: { id: itemId, eventId } });
      if (!item) throw new Error("El artículo no pertenece a este evento.");
      await tx.serviceEventItem.update({ where: { id: itemId }, data: { sentQuantity, checkedOut: true, checkoutStatus: sentQuantity === 0 ? "NO_SE_LLEVARA" : "REVISADO" } });
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Cantidad de salida actualizada." };
  } catch (error) {
    console.error("Error updating sent quantity:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible actualizar la cantidad." };
  }
}

export async function updateReturnedQuantityAction(
  itemId: string,
  eventId: string,
  returnedQuantity: number,
  damagedQuantity: number,
  returnedOpenQuantity = 0,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    if (!Number.isFinite(returnedQuantity) || !Number.isFinite(damagedQuantity) || !Number.isFinite(returnedOpenQuantity) || returnedQuantity < 0 || damagedQuantity < 0 || returnedOpenQuantity < 0) {
      return { success: false, error: "Las cantidades no pueden ser negativas." };
    }

    await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (!event.checkoutConfirmedAt) throw new Error("Confirma la salida antes de registrar el regreso.");
      if (event.returnConfirmedAt) throw new Error("El regreso ya fue confirmado.");
      const item = await tx.serviceEventItem.findFirst({ where: { id: itemId, eventId } });
      if (!item) throw new Error("El artículo no pertenece a este evento.");
      const sent = Number(item.sentQuantity ?? item.plannedQuantity);
      const content = item.contentPerUnit ? Number(item.contentPerUnit) : null;
      const contentBase = content === null ? null : ["L", "KG"].includes(item.contentUnit ?? "") ? content * 1000 : content;
      if (returnedOpenQuantity > 0 && (!contentBase || returnedOpenQuantity >= contentBase)) throw new Error("El remanente debe ser menor al contenido de la presentación.");
      const openUnits = contentBase ? returnedOpenQuantity / contentBase : 0;
      if (returnedQuantity + damagedQuantity + openUnits > sent + 0.000001) throw new Error("Lo regresado y dañado no puede superar lo que salió.");
      const lostQuantity = Math.round(Math.max(sent - returnedQuantity - damagedQuantity - openUnits, 0) * 1000) / 1000;
      await tx.serviceEventItem.update({ where: { id: itemId }, data: { returnedQuantity, damagedQuantity, lostQuantity, checkedIn: true, returnedOpenQuantity, returnStatus: returnedQuantity === sent && !returnedOpenQuantity ? "COMPLETO" : "REVISADO" } });
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Regreso registrado." };
  } catch (error) {
    console.error("Error updating returned quantity:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible registrar el regreso." };
  }
}

export async function confirmEventCheckoutAction(eventId: string): Promise<ActionResult> {
  const user = await getEventActor(); if (!user) return { success: false, error: "No tienes permiso para administrar eventos." };
  try { await prisma.$transaction(async (tx) => { await lockEvent(tx, eventId); const event = await tx.serviceEvent.findUniqueOrThrow({ where: { id: eventId }, include: { items: true } }); if (event.checkoutConfirmedAt) return; if (!event.items.length || event.items.some((item) => !item.checkedOut)) throw new Error("Revisa todos los productos antes de confirmar."); await tx.serviceEvent.update({ where: { id: eventId }, data: { checkoutConfirmedAt: new Date(), checkoutConfirmedById: user.id, status: "READY" } }); }); revalidatePath(`/administration/inventory/events/${eventId}`); return { success: true, message: "Salida confirmada." }; } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No fue posible confirmar la salida." }; }
}

export async function confirmEventReturnAction(eventId: string): Promise<ActionResult> {
  const user = await getEventActor(); if (!user) return { success: false, error: "No tienes permiso para administrar eventos." };
  try { await prisma.$transaction(async (tx) => { await lockEvent(tx, eventId); const event = await tx.serviceEvent.findUniqueOrThrow({ where: { id: eventId }, include: { items: true } }); if (event.returnConfirmedAt) return; if (!event.checkoutConfirmedAt || !event.items.length || event.items.some((item) => !item.checkedIn)) throw new Error("Registra y revisa todos los productos antes de confirmar."); if (event.stockDeductedAt) {
      const cut = await tx.cashCut.findFirst({ where: { eventId }, orderBy: { createdAt: "asc" } });
      if (!cut) throw new Error("No se encontró la sucursal de salida del evento.");
      if (user.role !== "ADMIN" && !await tx.userBranch.findFirst({ where: { userId: user.id, branchId: cut.branchId } })) throw new Error("No tienes acceso a la sucursal de regreso.");
      const operationId = generateOperationId();
      for (const item of [...event.items].sort((a, b) => a.productId.localeCompare(b.productId))) await applyEventInventoryMovement(tx, { item, branchId: cut.branchId, actorId: user.id, operationId, eventId, returning: true });
    }
    await tx.serviceEvent.update({ where: { id: eventId }, data: { returnConfirmedAt: new Date(), returnConfirmedById: user.id, status: "COMPLETED" } }); }); revalidatePath(`/administration/inventory/events/${eventId}`); return { success: true, message: "Regreso confirmado." }; } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No fue posible confirmar el regreso." }; }
}

export async function addCustomEventItemAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    const eventId = formData.get("eventId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const plannedQuantity = readOptionalNumber(formData.get("plannedQuantity"));

    if (!eventId || !productId) {
      return { success: false, error: "Falta el evento o el producto." };
    }

    if (plannedQuantity === null || plannedQuantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (event.checkoutConfirmedAt || event.stockDeductedAt || event.returnConfirmedAt) throw new Error("La salida ya fue confirmada; no puedes cambiar el checklist.");
    const existing = await tx.serviceEventItem.findFirst({
      where: { eventId, productId },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Ese producto ya está en el checklist de este evento.");
    }

    const product = await tx.inventoryProduct.findUnique({
      where: { id: productId },
    });

    if (!product || product.archivedAt || !product.isActive) {
      throw new Error("Producto no encontrado.");
    }

    const maxSort = await tx.serviceEventItem.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    await tx.serviceEventItem.create({
      data: {
        eventId,
        productId,
        productName: product.name,
        unit: product.unit,
        itemType: product.itemType,
        unitCost: product.unitCost,
        handlingUnit: product.handlingUnit,
        contentPerUnit: product.contentPerUnit,
        contentUnit: product.contentUnit,
        plannedQuantity,
        isCustom: true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Producto agregado al evento." };
  } catch (error) {
    console.error("Error adding custom event item:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible agregar el producto." };
  }
}

export async function removeEventItemAction(
  itemId: string,
  eventId: string,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (event.checkoutConfirmedAt || event.stockDeductedAt || event.returnConfirmedAt) throw new Error("La salida ya fue confirmada; no puedes quitar artículos.");
      const item = await tx.serviceEventItem.findFirst({ where: { id: itemId, eventId } });
      if (!item) throw new Error("El artículo no pertenece a este evento.");
      await tx.serviceEventItem.delete({ where: { id: itemId } });
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Producto quitado del evento." };
  } catch (error) {
    console.error("Error removing event item:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible quitar el producto." };
  }
}

export async function updateEventStatusAction(
  eventId: string,
  status: ServiceEventStatus,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    if (!Object.values(ServiceEventStatus).includes(status)) throw new Error("Estado inválido.");
    await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (event.status === status) return;
      if (event.returnConfirmedAt) throw new Error("El regreso ya fue confirmado; no puedes reabrir el evento.");
      if (status === "COMPLETED") throw new Error("Confirma el regreso para completar el evento.");
      if (["READY", "IN_PROGRESS", "RETURN_PENDING"].includes(status) && !event.checkoutConfirmedAt) throw new Error("Confirma la salida antes de avanzar el evento.");
      if (event.checkoutConfirmedAt && ["DRAFT", "PREPARING", "CANCELLED"].includes(status)) throw new Error("Registra y confirma el regreso del evento antes de cambiar este estado.");
      await tx.serviceEvent.update({ where: { id: eventId }, data: { status } });
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);
    revalidatePath("/administration/inventory/events");

    return { success: true, message: "Estado actualizado." };
  } catch (error) {
    console.error("Error updating event status:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible actualizar el estado." };
  }
}

export type RecountActionResult =
  | { success: true; message: string; recountId: string }
  | { success: false; error: string };

/*
 * Reconteo rápido: se captura cuánto queda hoy de cada insumo que
 * salió al evento y se compara contra lo enviado originalmente
 * (sentQuantity) para calcular qué falta resurtir. Cada llamada crea
 * un día nuevo de reconteo (historial completo del evento).
 */
export async function createRecountAction(
  formData: FormData,
): Promise<RecountActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    const eventId = formData.get("eventId")?.toString() ?? "";

    if (!eventId) {
      return { success: false, error: "Falta el evento." };
    }

    const notes = formData.get("notes")?.toString().trim() || null;

    const entries: { eventItemId: string; counted: number }[] = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("qty_")) continue;

      const raw = value.toString().trim();
      if (raw === "") continue;

      const counted = Number(raw);

      if (!Number.isFinite(counted) || counted < 0) {
        return { success: false, error: "Las cantidades contadas no pueden ser negativas." };
      }

      entries.push({ eventItemId: key.slice(4), counted });
    }

    if (entries.length === 0) {
      return { success: false, error: "Captura al menos una cantidad contada." };
    }

    const items = await prisma.serviceEventItem.findMany({
      where: { id: { in: entries.map((e) => e.eventItemId) }, eventId },
      select: { id: true, sentQuantity: true, plannedQuantity: true },
    });

    const itemMap = new Map(items.map((item) => [item.id, item]));
    if (itemMap.size !== entries.length) throw new Error("Los artículos no pertenecen al evento o están repetidos.");

    const recount = await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (!event.checkoutConfirmedAt || event.returnConfirmedAt) throw new Error("El evento no está abierto para reconteos.");
      const lastRecount = await tx.eventRecount.aggregate({
        where: { eventId },
        _max: { dayNumber: true },
      });

      const dayNumber = (lastRecount._max.dayNumber ?? 0) + 1;

      const created = await tx.eventRecount.create({
        data: { eventId, dayNumber, notes },
        select: { id: true },
      });

      for (const entry of entries) {
        const item = itemMap.get(entry.eventItemId);
        if (!item) continue;

        const sent =
          item.sentQuantity !== null ? Number(item.sentQuantity) : Number(item.plannedQuantity);
        const missing = Math.max(sent - entry.counted, 0);

        await tx.eventRecountItem.create({
          data: {
            recountId: created.id,
            eventItemId: entry.eventItemId,
            countedQuantity: entry.counted,
            missingQuantity: missing,
          },
        });
      }

      return created;
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Reconteo guardado.", recountId: recount.id };
  } catch (error) {
    console.error("Error creating recount:", error);
    return { success: false, error: "No fue posible guardar el reconteo." };
  }
}

export async function markRecountFulfilledAction(
  recountId: string,
  eventId: string,
): Promise<ActionResult> {
  try {
    if (!(await getEventActor())) return { success: false, error: "No tienes permiso para administrar eventos." };
    await prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const recount = await tx.eventRecount.findFirst({ where: { id: recountId, eventId } });
      if (!recount) throw new Error("El reconteo no pertenece a este evento.");
      if (recount.status === "SURTIDO") return;
      await tx.eventRecount.update({ where: { id: recountId }, data: { status: "SURTIDO", fulfilledAt: new Date() } });
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);
    revalidatePath(`/administration/inventory/events/${eventId}/recount/${recountId}/print`);

    return { success: true, message: "Marcado como surtido." };
  } catch (error) {
    console.error("Error marking recount fulfilled:", error);
    return { success: false, error: error instanceof Error ? error.message : "No fue posible actualizar el estado." };
  }
}
