"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  addPayrollAdjustment, approvePayrollLine, approveReadyPayrollPeriod, calculatePayrollLine,
  createPayrollCategory, markPayrollPaid, setPayrollCategoryActive,
} from "@/lib/workforce/payroll/service";

const path = "/administration/workforce-v1/payroll";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function actor() { const user = await requireAdmin(); return { id: user.id, role: user.role }; }
const destination = (base: string, key: string, content: string) =>
  `${base}${base.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(content)}`;
async function run(operation: () => Promise<unknown>, returnPath = path) {
  try { await operation(); revalidatePath(path); revalidatePath("/workforce-v1/payroll"); }
  catch (error) { unstable_rethrow(error); redirect(destination(returnPath, "error", error instanceof Error ? error.message : "Operación inválida.")); }
  redirect(destination(returnPath, "saved", "1"));
}

export async function calculatePayrollAction(form: FormData) {
  const user = await actor(); const week = value(form, "week");
  return run(() => calculatePayrollLine(user, value(form, "timesheetId")), `${path}?week=${week}`);
}
export async function addPayrollAdjustmentAction(form: FormData) {
  const user = await actor(); const week = value(form, "week");
  return run(() => addPayrollAdjustment(user, {
    payrollLineId: value(form, "payrollLineId"), categoryId: value(form, "categoryId"),
    amount: value(form, "amount"), reason: value(form, "reason"), idempotencyKey: value(form, "idempotencyKey"),
  }), `${path}?week=${week}`);
}
export async function approvePayrollAction(form: FormData) {
  const user = await actor(); const week = value(form, "week");
  return run(() => approvePayrollLine(user, {
    payrollLineId: value(form, "payrollLineId"), expectedVersion: Number(value(form, "version")),
    idempotencyKey: value(form, "idempotencyKey"),
  }), `${path}?week=${week}`);
}
export async function markPayrollPaidAction(form: FormData) {
  const user = await actor(); const week = value(form, "week");
  return run(() => markPayrollPaid(user, {
    payrollLineId: value(form, "payrollLineId"), expectedVersion: Number(value(form, "version")),
    idempotencyKey: value(form, "idempotencyKey"), reference: value(form, "reference"),
  }), `${path}?week=${week}`);
}
export async function approveReadyPayrollPeriodAction(form: FormData) {
  const user = await actor(); const week = value(form, "week");
  return run(() => approveReadyPayrollPeriod(user, {
    payrollPeriodId: value(form, "payrollPeriodId"), idempotencyKey: value(form, "idempotencyKey"),
  }), `${path}?week=${week}`);
}
export async function createPayrollCategoryAction(form: FormData) {
  const user = await actor();
  return run(() => createPayrollCategory(user, {
    name: value(form, "name"), direction: value(form, "direction") as "EARNING" | "DEDUCTION",
  }), "/administration/workforce-v1/settings");
}
export async function setPayrollCategoryActiveAction(form: FormData) {
  const user = await actor();
  return run(() => setPayrollCategoryActive(user, {
    id: value(form, "categoryId"), active: value(form, "active") === "true",
  }), "/administration/workforce-v1/settings");
}
