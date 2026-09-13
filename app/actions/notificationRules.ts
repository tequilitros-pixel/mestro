"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { NotificationTriggerType, UserRole } from "@prisma/client";

export type ActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string };

const VALID_TRIGGER_TYPES: NotificationTriggerType[] = [
  "STOCK_BAJO",
  "LICOR_CADUCIDAD",
  "RECONTEO_PENDIENTE",
  "CORTE_DIFERENCIA",
  "PROCESO_ATRASADO",
];

const VALID_ROLES: UserRole[] = ["ADMIN", "OPERATOR", "GERENTE", "ENCARGADO", "CONSULTA"];

export async function getNotificationRules() {
  return prisma.notificationRule.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getNotificationRuleById(id: string) {
  return prisma.notificationRule.findUnique({ where: { id } });
}

function buildThresholdConfig(triggerType: string, formData: FormData) {
  if (triggerType === "LICOR_CADUCIDAD") {
    const days = Number(formData.get("daysBeforeExpiration"));
    return { daysBeforeExpiration: Number.isFinite(days) && days > 0 ? days : 7 };
  }

  if (triggerType === "CORTE_DIFERENCIA") {
    const minDifference = Number(formData.get("minDifference"));
    return { minDifference: Number.isFinite(minDifference) && minDifference >= 0 ? minDifference : 10 };
  }

  return {};
}

export async function createNotificationRuleAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso para crear reglas de notificación." };
    }

    const name = formData.get("name")?.toString().trim() ?? "";
    const triggerType = formData.get("triggerType")?.toString() ?? "";
    const checkFrequencyMinutes = Number(formData.get("checkFrequencyMinutes"));
    const recipientRoles = formData.getAll("recipientRoles").map((r) => r.toString());

    if (!name) {
      return { success: false, error: "El nombre es obligatorio." };
    }

    if (!VALID_TRIGGER_TYPES.includes(triggerType as NotificationTriggerType)) {
      return { success: false, error: "Selecciona un tipo de notificación válido." };
    }

    if (!Number.isFinite(checkFrequencyMinutes) || checkFrequencyMinutes < 15) {
      return { success: false, error: "La frecuencia mínima es de 15 minutos." };
    }

    const validRoles = recipientRoles.filter((r): r is UserRole =>
      VALID_ROLES.includes(r as UserRole),
    );

    if (validRoles.length === 0) {
      return { success: false, error: "Selecciona al menos un rol destinatario." };
    }

    const rule = await prisma.notificationRule.create({
      data: {
        name,
        triggerType: triggerType as NotificationTriggerType,
        checkFrequencyMinutes: Math.trunc(checkFrequencyMinutes),
        recipientRoles: validRoles,
        thresholdConfig: buildThresholdConfig(triggerType, formData),
        active: true,
        createdById: user.id,
      },
      select: { id: true },
    });

    revalidatePath("/administration/personnel/notifications");

    return { success: true, message: "Regla creada correctamente.", id: rule.id };
  } catch (error) {
    console.error("Error creating notification rule:", error);
    return { success: false, error: "No fue posible crear la regla." };
  }
}

export async function updateNotificationRuleAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso para editar reglas de notificación." };
    }

    const name = formData.get("name")?.toString().trim() ?? "";
    const triggerType = formData.get("triggerType")?.toString() ?? "";
    const checkFrequencyMinutes = Number(formData.get("checkFrequencyMinutes"));
    const recipientRoles = formData.getAll("recipientRoles").map((r) => r.toString());

    if (!name) {
      return { success: false, error: "El nombre es obligatorio." };
    }

    if (!VALID_TRIGGER_TYPES.includes(triggerType as NotificationTriggerType)) {
      return { success: false, error: "Selecciona un tipo de notificación válido." };
    }

    if (!Number.isFinite(checkFrequencyMinutes) || checkFrequencyMinutes < 15) {
      return { success: false, error: "La frecuencia mínima es de 15 minutos." };
    }

    const validRoles = recipientRoles.filter((r): r is UserRole =>
      VALID_ROLES.includes(r as UserRole),
    );

    if (validRoles.length === 0) {
      return { success: false, error: "Selecciona al menos un rol destinatario." };
    }

    await prisma.notificationRule.update({
      where: { id },
      data: {
        name,
        triggerType: triggerType as NotificationTriggerType,
        checkFrequencyMinutes: Math.trunc(checkFrequencyMinutes),
        recipientRoles: validRoles,
        thresholdConfig: buildThresholdConfig(triggerType, formData),
      },
    });

    revalidatePath("/administration/personnel/notifications");
    revalidatePath(`/administration/personnel/notifications/${id}`);

    return { success: true, message: "Regla actualizada correctamente." };
  } catch (error) {
    console.error("Error updating notification rule:", error);
    return { success: false, error: "No fue posible actualizar la regla." };
  }
}

export async function toggleNotificationRuleAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso para modificar reglas de notificación." };
    }

    await prisma.notificationRule.update({ where: { id }, data: { active } });

    revalidatePath("/administration/personnel/notifications");

    return { success: true, message: active ? "Regla activada." : "Regla desactivada." };
  } catch (error) {
    console.error("Error toggling notification rule:", error);
    return { success: false, error: "No fue posible actualizar la regla." };
  }
}

export async function deleteNotificationRuleAction(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso para eliminar reglas de notificación." };
    }

    await prisma.notificationRule.delete({ where: { id } });

    revalidatePath("/administration/personnel/notifications");

    return { success: true, message: "Regla eliminada." };
  } catch (error) {
    console.error("Error deleting notification rule:", error);
    return { success: false, error: "No fue posible eliminar la regla." };
  }
}
