"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

function readOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value.toString().trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function createEquipmentKitAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const name = formData.get("name")?.toString().trim() ?? "";
    const description = formData.get("description")?.toString().trim() || null;

    if (!name) {
      return { success: false, error: "El nombre del kit es obligatorio." };
    }

    const existing = await prisma.equipmentKit.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: `Ya existe un kit llamado "${name}".` };
    }

    const kit = await prisma.equipmentKit.create({
      data: { name, description, isActive: true },
      select: { id: true },
    });

    revalidatePath("/administration/inventory/equipment-kits");

    return { success: true, message: "Kit creado correctamente.", id: kit.id };
  } catch (error) {
    console.error("Error creating equipment kit:", error);
    return { success: false, error: "No fue posible crear el kit." };
  }
}

export async function addEquipmentKitItemAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const kitId = formData.get("kitId")?.toString() ?? "";
    const productId = formData.get("productId")?.toString() ?? "";
    const quantity = readOptionalNumber(formData.get("quantity"));
    const isRequired = formData.get("isRequired") === "on";
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!kitId || !productId) {
      return { success: false, error: "Falta el kit o el producto." };
    }

    if (quantity === null || quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a cero." };
    }

    const existing = await prisma.equipmentKitItem.findUnique({
      where: { kitId_productId: { kitId, productId } },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "Ese producto ya está en el kit." };
    }

    await prisma.equipmentKitItem.create({
      data: { kitId, productId, quantity, isRequired, notes },
    });

    revalidatePath(`/administration/inventory/equipment-kits/${kitId}`);

    return { success: true, message: "Producto agregado al kit." };
  } catch (error) {
    console.error("Error adding kit item:", error);
    return { success: false, error: "No fue posible agregar el producto." };
  }
}

export async function removeEquipmentKitItemAction(
  itemId: string,
  kitId: string,
): Promise<ActionResult> {
  try {
    await prisma.equipmentKitItem.delete({ where: { id: itemId } });

    revalidatePath(`/administration/inventory/equipment-kits/${kitId}`);

    return { success: true, message: "Producto quitado del kit." };
  } catch (error) {
    console.error("Error removing kit item:", error);
    return { success: false, error: "No fue posible quitar el producto." };
  }
}
