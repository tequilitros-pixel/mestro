"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/auth";
import { categoryCode } from "@/lib/financialMovementCategories";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const bool = (form: FormData, key: string) => form.get(key) === "on";
const refresh = () => revalidatePath("/administration/financial-categories");

export async function createFinancialCategoryAction(form: FormData) {
  const user = await requireAdminAction();
  const name = text(form, "name");
  const code = categoryCode(text(form, "code") || name);
  if (name.length < 2) throw new Error("El nombre es obligatorio");
  await prisma.financialMovementCategory.create({ data: { name, code, direction: text(form, "direction") === "INCOME" ? "INCOME" : "EXPENSE", scope: text(form, "scope") === "CASH" ? "CASH" : text(form, "scope") === "ENVELOPE" ? "ENVELOPE" : "BOTH", group: text(form, "group") || null, requiresReason: bool(form, "requiresReason"), requiresReceipt: bool(form, "requiresReceipt"), sortOrder: Number(form.get("sortOrder") ?? 0) || 0, createdById: user.id, updatedById: user.id } });
  refresh();
}

export async function updateFinancialCategoryAction(form: FormData) {
  const user = await requireAdminAction();
  const id = text(form, "id");
  await prisma.financialMovementCategory.update({ where: { id }, data: { name: text(form, "name"), direction: text(form, "direction") === "INCOME" ? "INCOME" : "EXPENSE", scope: text(form, "scope") === "CASH" ? "CASH" : text(form, "scope") === "ENVELOPE" ? "ENVELOPE" : "BOTH", group: text(form, "group") || null, requiresReason: bool(form, "requiresReason"), requiresReceipt: bool(form, "requiresReceipt"), isActive: bool(form, "isActive"), sortOrder: Number(form.get("sortOrder") ?? 0) || 0, updatedById: user.id } });
  refresh();
}
