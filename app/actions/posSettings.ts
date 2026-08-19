"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export type PosSettingsActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const ROLES_CON_LIMITE: UserRole[] = ["ADMIN", "GERENTE", "ENCARGADO"];

export async function getDiscountLimits(): Promise<Record<string, number | null>> {
  await requireAdmin();
  const rows = await prisma.posDiscountLimit.findMany();
  const byRole = new Map(rows.map((r) => [r.role, r.maxPercent]));

  return Object.fromEntries(ROLES_CON_LIMITE.map((role) => [role, byRole.get(role) ?? null]));
}

export async function updateDiscountLimitsAction(
  formData: FormData,
): Promise<PosSettingsActionResult> {
  const user = await requireAdmin();

  for (const role of ROLES_CON_LIMITE) {
    const raw = formData.get(`limit_${role}`)?.toString().trim() ?? "";

    if (raw === "") {
      await prisma.posDiscountLimit.deleteMany({ where: { role } });
      continue;
    }

    const maxPercent = Number(raw);
    if (!Number.isFinite(maxPercent) || maxPercent < 0 || maxPercent > 100) {
      return { success: false, error: `El límite de ${role} debe estar entre 0 y 100, o vacío para sin límite.` };
    }

    await prisma.posDiscountLimit.upsert({
      where: { role },
      update: { maxPercent, updatedById: user.id },
      create: { role, maxPercent, updatedById: user.id },
    });
  }

  revalidatePath("/pos/settings");

  return { success: true, message: "Límites guardados correctamente." };
}

export async function getPosSettings() {
  await requireAdmin();
  const settings = await prisma.posSettings.findUnique({ where: { id: "default" } });
  return {
    employeeDiscountPercent: settings?.employeeDiscountPercent ?? 50,
    employeeBottleMonthlyLimit: settings?.employeeBottleMonthlyLimit ?? 2,
  };
}

export async function updatePosSettingsAction(
  formData: FormData,
): Promise<PosSettingsActionResult> {
  const user = await requireAdmin();

  const employeeDiscountPercent = Number(formData.get("employeeDiscountPercent"));
  const employeeBottleMonthlyLimit = Number(formData.get("employeeBottleMonthlyLimit"));

  if (!Number.isFinite(employeeDiscountPercent) || employeeDiscountPercent < 0 || employeeDiscountPercent > 100) {
    return { success: false, error: "El porcentaje de descuento de empleado debe estar entre 0 y 100." };
  }

  if (!Number.isInteger(employeeBottleMonthlyLimit) || employeeBottleMonthlyLimit < 0) {
    return { success: false, error: "El límite mensual de botellas debe ser un número entero mayor o igual a 0." };
  }

  await prisma.posSettings.upsert({
    where: { id: "default" },
    update: { employeeDiscountPercent, employeeBottleMonthlyLimit, updatedById: user.id },
    create: {
      id: "default",
      employeeDiscountPercent,
      employeeBottleMonthlyLimit,
      updatedById: user.id,
    },
  });

  revalidatePath("/pos/settings");

  return { success: true, message: "Configuración guardada correctamente." };
}
