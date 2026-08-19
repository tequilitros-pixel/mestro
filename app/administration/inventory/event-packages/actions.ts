"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PackageItemCalculationType } from "@prisma/client";


export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

function readOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value.toString().trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type SubmittedItem = { productId: string; quantity: number };

function readItems(formData: FormData): SubmittedItem[] | null {
  const raw = formData.get("items")?.toString() ?? "[]";
  try {
    const items = JSON.parse(raw) as SubmittedItem[];
    if (!Array.isArray(items) || !items.length || items.some((item) => !item.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) || new Set(items.map((item) => item.productId)).size !== items.length) return null;
    return items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }));
  } catch { return null; }
}

export async function createEventPackageAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";
    const description = formData.get("description")?.toString().trim() || null;
    const pricePerPerson = readOptionalNumber(formData.get("pricePerPerson"));
    const includedHours = readOptionalNumber(formData.get("includedHours"));
    const minimumGuests = readOptionalNumber(formData.get("minimumGuests"));
    const items = readItems(formData);

    if (!name) {
      return { success: false, error: "El nombre del paquete es obligatorio." };
    }
    if (!items) return { success: false, error: "Selecciona al menos un producto y captura una cantidad mayor a cero." };

    const activeProducts = await prisma.inventoryProduct.findMany({ where: { id: { in: items.map((item) => item.productId) }, isActive: true }, select: { id: true } });
    if (activeProducts.length !== items.length) return { success: false, error: "Uno o más productos están inactivos o ya no existen." };

    if (pricePerPerson !== null && pricePerPerson < 0) {
      return { success: false, error: "El precio por persona no puede ser negativo." };
    }

    const eventPackage = await prisma.eventPackage.create({
      data: {
        name,
        description,
        pricePerPerson,
        includedHours: includedHours !== null ? Math.trunc(includedHours) : null,
        minimumGuests: minimumGuests !== null ? Math.trunc(minimumGuests) : null,
        isActive: true,
        items: { create: items.map((item, sortOrder) => ({ productId: item.productId, quantity: item.quantity, calculationType: "FIXED", isRequired: true, sortOrder })) },
      },
      select: { id: true },
    });

    revalidatePath("/administration/inventory/event-packages");
    revalidatePath("/administration/inventory/events/new");

    return { success: true, message: "Paquete creado correctamente.", id: eventPackage.id };
  } catch (error) {
    console.error("Error creating event package:", error);
    return { success: false, error: "No fue posible crear el paquete." };
  }
}

export async function togglePackageActiveAction(
  packageId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await prisma.eventPackage.update({
      where: { id: packageId },
      data: { isActive },
    });

    revalidatePath("/administration/inventory/event-packages");

    return { success: true, message: isActive ? "Paquete activado." : "Paquete desactivado." };
  } catch (error) {
    console.error("Error toggling package:", error);
    return { success: false, error: "No fue posible actualizar el paquete." };
  }
}

export async function addEventPackageItemAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const packageId = formData.get("packageId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const calculationType = formData.get("calculationType")?.toString() ?? "";
    const quantity = readOptionalNumber(formData.get("quantity"));
    const guestsPerBlock = readOptionalNumber(formData.get("guestsPerBlock"));
    const isRequired = formData.get("isRequired") === "on";
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!packageId || !productId) {
      return { success: false, error: "Falta el paquete o el producto." };
    }

    if (quantity === null || quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    const validTypes = ["FIXED", "PER_GUEST", "PER_GUEST_BLOCK", "MANUAL"];
    if (!validTypes.includes(calculationType)) {
      return { success: false, error: "Selecciona un tipo de cálculo válido." };
    }

    if (calculationType === "PER_GUEST_BLOCK" && (guestsPerBlock === null || guestsPerBlock <= 0)) {
      return { success: false, error: "Indica cuántos invitados por bloque." };
    }

    const existing = await prisma.eventPackageItem.findUnique({
      where: { packageId_productId: { packageId, productId } },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "Ese producto ya está en el paquete." };
    }
    const product = await prisma.inventoryProduct.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
    if (!product) return { success: false, error: "No se puede agregar un producto inactivo." };

    await prisma.eventPackageItem.create({
      data: {
        packageId,
        productId,
        quantity,
       calculationType: calculationType as PackageItemCalculationType,
        guestsPerBlock: guestsPerBlock !== null ? Math.trunc(guestsPerBlock) : null,
        isRequired,
        notes,
      },
    });

    revalidatePath(`/administration/inventory/event-packages/${packageId}`);

    return { success: true, message: "Producto agregado al paquete." };
  } catch (error) {
    console.error("Error adding package item:", error);
    return { success: false, error: "No fue posible agregar el producto." };
  }
}

export async function removeEventPackageItemAction(
  itemId: string,
  packageId: string,
): Promise<ActionResult> {
  try {
    await prisma.eventPackageItem.delete({ where: { id: itemId } });

    revalidatePath(`/administration/inventory/event-packages/${packageId}`);

    return { success: true, message: "Producto quitado del paquete." };
  } catch (error) {
    console.error("Error removing package item:", error);
    return { success: false, error: "No fue posible quitar el producto." };
  }
}
export async function updateEventPackageItemAction(
  itemId: string,
  packageId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const calculationType = formData.get("calculationType")?.toString() ?? "";
    const quantity = readOptionalNumber(formData.get("quantity"));
    const guestsPerBlock = readOptionalNumber(formData.get("guestsPerBlock"));
    const isRequired = formData.get("isRequired") === "on";

    if (quantity === null || quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    const validTypes = ["FIXED", "PER_GUEST", "PER_GUEST_BLOCK", "MANUAL"];
    if (!validTypes.includes(calculationType)) {
      return { success: false, error: "Selecciona un tipo de cálculo válido." };
    }

    if (calculationType === "PER_GUEST_BLOCK" && (guestsPerBlock === null || guestsPerBlock <= 0)) {
      return { success: false, error: "Indica cuántos invitados por bloque." };
    }

    await prisma.eventPackageItem.update({
      where: { id: itemId },
      data: {
        quantity,
        calculationType: calculationType as PackageItemCalculationType,
        guestsPerBlock:
          calculationType === "PER_GUEST_BLOCK" && guestsPerBlock !== null
            ? Math.trunc(guestsPerBlock)
            : null,
        isRequired,
      },
    });

    revalidatePath(`/administration/inventory/event-packages/${packageId}`);

    return { success: true, message: "Producto actualizado." };
  } catch (error) {
    console.error("Error updating package item:", error);
    return { success: false, error: "No fue posible actualizar el producto." };
  }
}

export async function deleteEventPackageAction(
  packageId: string,
): Promise<ActionResult> {
  try {
    const eventCount = await prisma.serviceEvent.count({ where: { packageId } });

    if (eventCount > 0) {
      return {
        success: false,
        error:
          "Este paquete ya se usó en eventos. No se puede eliminar sin perder ese historial — mejor desactívalo.",
      };
    }

    await prisma.eventPackage.delete({ where: { id: packageId } });

    revalidatePath("/administration/inventory/event-packages");

    return { success: true, message: "Paquete eliminado." };
  } catch (error) {
    console.error("Error deleting event package:", error);
    return { success: false, error: "No fue posible eliminar el paquete." };
  }
}

export async function updateEventPackageAction(
  packageId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";
    const description = formData.get("description")?.toString().trim() || null;
    const pricePerPerson = readOptionalNumber(formData.get("pricePerPerson"));
    const includedHours = readOptionalNumber(formData.get("includedHours"));
    const minimumGuests = readOptionalNumber(formData.get("minimumGuests"));

    if (!name) {
      return { success: false, error: "El nombre del paquete es obligatorio." };
    }

    if (pricePerPerson !== null && pricePerPerson < 0) {
      return { success: false, error: "El precio por persona no puede ser negativo." };
    }

    await prisma.eventPackage.update({
      where: { id: packageId },
      data: {
        name,
        description,
        pricePerPerson,
        includedHours: includedHours !== null ? Math.trunc(includedHours) : null,
        minimumGuests: minimumGuests !== null ? Math.trunc(minimumGuests) : null,
      },
    });

    revalidatePath(`/administration/inventory/event-packages/${packageId}`);
    revalidatePath("/administration/inventory/event-packages");

    return { success: true, message: "Paquete actualizado correctamente." };
  } catch (error) {
    console.error("Error updating event package:", error);
    return { success: false, error: "No fue posible actualizar el paquete." };
  }
}
