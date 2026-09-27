"use server";

import { revalidatePath } from "next/cache";
import type { PosDiscountRuleMode } from "@prisma/client";
import { parseDateOnly } from "@/lib/dateOnly";
import { requireModuleActionAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POS_PERMISSION = "/pos";

export async function savePospressDiscountRule(formData: FormData) {
  const user = await requireModuleActionAccess(POS_PERMISSION);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const mode: PosDiscountRuleMode = formData.get("mode") === "BLOCK" ? "BLOCK" : "DISCOUNT";
  const percentValue = Number(formData.get("percent"));
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  const branchIds = formData.getAll("branchId").map(String).filter(Boolean);

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

  revalidatePath("/pospress/discounts");
  revalidatePath("/pospress");
}

export async function deletePospressDiscountRule(formData: FormData) {
  await requireModuleActionAccess(POS_PERMISSION);
  const id = String(formData.get("id") ?? "").trim();
  if (id) await prisma.posDiscountRule.delete({ where: { id } });
  revalidatePath("/pospress/discounts");
}
