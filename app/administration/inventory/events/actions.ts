"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ServiceEventStatus } from "@prisma/client";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

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

    const eventDate = new Date(eventDateRaw);

    if (Number.isNaN(eventDate.getTime())) {
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
    if (sentQuantity < 0) {
      return { success: false, error: "La cantidad no puede ser negativa." };
    }

    await prisma.serviceEventItem.update({
      where: { id: itemId },
      data: { sentQuantity, checkedOut: true },
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Cantidad de salida actualizada." };
  } catch (error) {
    console.error("Error updating sent quantity:", error);
    return { success: false, error: "No fue posible actualizar la cantidad." };
  }
}

export async function updateReturnedQuantityAction(
  itemId: string,
  eventId: string,
  returnedQuantity: number,
  damagedQuantity: number,
): Promise<ActionResult> {
  try {
    if (returnedQuantity < 0 || damagedQuantity < 0) {
      return { success: false, error: "Las cantidades no pueden ser negativas." };
    }

    const item = await prisma.serviceEventItem.findUnique({
      where: { id: itemId },
      select: { sentQuantity: true, plannedQuantity: true },
    });

    if (!item) {
      return { success: false, error: "Producto no encontrado en el evento." };
    }

    const sent =
      item.sentQuantity !== null
        ? Number(item.sentQuantity)
        : Number(item.plannedQuantity);
    const lostQuantity = Math.max(sent - returnedQuantity - damagedQuantity, 0);

    await prisma.serviceEventItem.update({
      where: { id: itemId },
      data: {
        returnedQuantity,
        damagedQuantity,
        lostQuantity,
        checkedIn: true,
      },
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Regreso registrado." };
  } catch (error) {
    console.error("Error updating returned quantity:", error);
    return { success: false, error: "No fue posible registrar el regreso." };
  }
}

export async function addCustomEventItemAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const eventId = formData.get("eventId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const plannedQuantity = readOptionalNumber(formData.get("plannedQuantity"));

    if (!eventId || !productId) {
      return { success: false, error: "Falta el evento o el producto." };
    }

    if (plannedQuantity === null || plannedQuantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    const existing = await prisma.serviceEventItem.findFirst({
      where: { eventId, productId },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "Ese producto ya está en el checklist de este evento." };
    }

    const product = await prisma.inventoryProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, error: "Producto no encontrado." };
    }

    const maxSort = await prisma.serviceEventItem.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    await prisma.serviceEventItem.create({
      data: {
        eventId,
        productId,
        productName: product.name,
        unit: product.unit,
        itemType: product.itemType,
        unitCost: product.unitCost,
        plannedQuantity,
        isCustom: true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Producto agregado al evento." };
  } catch (error) {
    console.error("Error adding custom event item:", error);
    return { success: false, error: "No fue posible agregar el producto." };
  }
}

export async function removeEventItemAction(
  itemId: string,
  eventId: string,
): Promise<ActionResult> {
  try {
    await prisma.serviceEventItem.delete({ where: { id: itemId } });

    revalidatePath(`/administration/inventory/events/${eventId}`);

    return { success: true, message: "Producto quitado del evento." };
  } catch (error) {
    console.error("Error removing event item:", error);
    return { success: false, error: "No fue posible quitar el producto." };
  }
}

export async function updateEventStatusAction(
  eventId: string,
  status: ServiceEventStatus,
): Promise<ActionResult> {
  try {
    await prisma.serviceEvent.update({
      where: { id: eventId },
      data: { status },
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);
    revalidatePath("/administration/inventory/events");

    return { success: true, message: "Estado actualizado." };
  } catch (error) {
    console.error("Error updating event status:", error);
    return { success: false, error: "No fue posible actualizar el estado." };
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

    const recount = await prisma.$transaction(async (tx) => {
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
    await prisma.eventRecount.update({
      where: { id: recountId },
      data: { status: "SURTIDO", fulfilledAt: new Date() },
    });

    revalidatePath(`/administration/inventory/events/${eventId}`);
    revalidatePath(`/administration/inventory/events/${eventId}/recount/${recountId}/print`);

    return { success: true, message: "Marcado como surtido." };
  } catch (error) {
    console.error("Error marking recount fulfilled:", error);
    return { success: false, error: "No fue posible actualizar el estado." };
  }
}
