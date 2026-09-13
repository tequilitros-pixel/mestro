"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import type { PosDiscountRuleMode } from "@prisma/client";

export async function savePosDiscountRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("No autorizado");

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const mode: PosDiscountRuleMode = formData.get("mode") === "BLOCK" ? "BLOCK" : "DISCOUNT";
  const percentValue = Number(formData.get("percent"));
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  const branchIds = formData.getAll("branchId").map(String);

  if (!name) throw new Error("Escribe un nombre para la regla.");
  if (mode === "DISCOUNT" && (!Number.isFinite(percentValue) || percentValue <= 0 || percentValue > 100)) {
    throw new Error("El porcentaje debe estar entre 0 y 100.");
  }
  if (start && end && start > end) throw new Error("La fecha final no puede ser anterior a la inicial.");

  const data = {
    name,
    mode,
    percent: mode === "DISCOUNT" ? percentValue : null,
    active: formData.get("active") === "on",
    startDate: start ? parseDateOnly(start) : null,
    endDate: end ? parseDateOnly(end) : null,
    branches: { set: branchIds.map((branchId) => ({ id: branchId })) },
    updatedById: user.id,
  };

  if (id) {
    await prisma.posDiscountRule.update({ where: { id }, data });
  } else {
    await prisma.posDiscountRule.create({
      data: {
        ...data,
        branches: { connect: branchIds.map((branchId) => ({ id: branchId })) },
        createdById: user.id,
      },
    });
  }
  revalidatePath("/pos/discounts/rules");
  revalidatePath("/pos");
}

export async function deletePosDiscountRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("No autorizado");
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.posDiscountRule.delete({ where: { id } });
  revalidatePath("/pos/discounts/rules");
}
