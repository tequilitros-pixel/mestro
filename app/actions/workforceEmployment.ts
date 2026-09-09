"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { workforceV1Enabled } from "@/lib/workforce/config";
import { assertWorkforceAdministrator } from "@/lib/workforce/employment/rules";
import { addBranchAssignment, changeEmploymentStatus, changeHomeBranch, changePayRate, createEmployee } from "@/lib/workforce/employment/service";
import { parseDateOnly } from "@/lib/dateOnly";

async function authorize() {
  if (!workforceV1Enabled()) throw new Error("Workforce V1 no está habilitado.");
  const user = await getCurrentUser();
  assertWorkforceAdministrator(user);
  if (!user) throw new Error("No autorizado");
  return user;
}

function dateValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  const date = value ? parseDateOnly(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${key}`);
  return date;
}

export async function createWorkforceEmployeeAction(formData: FormData) {
  await authorize();
  const rateAmount = Number(formData.get("rateAmount"));
  const employee = await createEmployee({
    displayName: String(formData.get("displayName") ?? ""),
    firstName: String(formData.get("firstName") ?? "") || null,
    lastName: String(formData.get("lastName") ?? "") || null,
    employeeNumber: String(formData.get("employeeNumber") ?? "") || null,
    userId: String(formData.get("userId") ?? "") || null,
    employment: {
      status: String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "INACTIVE" | "TERMINATED",
      startedAt: String(formData.get("startedAt") ?? "") ? dateValue(formData, "startedAt") : null,
      dataConfidence: String(formData.get("startedAt") ?? "") ? "KNOWN" : "LEGACY_UNKNOWN",
      homeBranchId: String(formData.get("homeBranchId") ?? "") || null,
      effectiveFrom: dateValue(formData, "effectiveFrom"),
      payRate: Number.isFinite(rateAmount) && rateAmount > 0 ? { rateType: String(formData.get("rateType") ?? "HOURLY") as "HOURLY" | "DAILY" | "WEEKLY" | "SALARY", amount: rateAmount, currency: String(formData.get("currency") ?? "").toUpperCase(), effectiveFrom: dateValue(formData, "effectiveFrom") } : undefined,
    },
  });
  revalidatePath("/administration/workforce");
  redirect(`/administration/workforce/employees/${employee.id}`);
}

export async function changeWorkforceHomeAction(formData: FormData) {
  await authorize();
  const employeeId = String(formData.get("employeeId"));
  const branchId = String(formData.get("branchId"));
  const employmentId = String(formData.get("employmentId"));
  const effectiveFrom = dateValue(formData, "effectiveFrom");
  let error: string | null = null;
  let assignmentSaved = false;
  try {
    await changeHomeBranch({ employmentId, branchId, effectiveFrom });
    assignmentSaved = true;

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Error desconocido.";
    error = assignmentSaved
      ? `Sucursal HOME guardada; la plantilla no se aplicó: ${message}`
      : `No fue posible cambiar la sucursal HOME: ${message}`;
  }
  if (error) redirect(`/administration/workforce/employees/${employeeId}?error=${encodeURIComponent(error)}${assignmentSaved ? `&assignedBranch=${encodeURIComponent(branchId)}` : ""}`);
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
  redirect(`/administration/workforce/employees/${employeeId}?assignedBranch=${encodeURIComponent(branchId)}&assignedFrom=${effectiveFrom.toISOString().slice(0, 10)}`);
}

export async function addWorkforceAllowedBranchAction(formData: FormData) {
  await authorize();
  await addBranchAssignment({ employmentId: String(formData.get("employmentId")), branchId: String(formData.get("branchId")), type: "ALLOWED", effectiveFrom: dateValue(formData, "effectiveFrom") });
  revalidatePath(`/administration/workforce/employees/${String(formData.get("employeeId"))}`);
}

export async function changeWorkforcePayRateAction(formData: FormData) {
  await authorize();
  const employeeId = String(formData.get("employeeId"));
  let error: string | null = null;
  try {
    await changePayRate({ employmentId: String(formData.get("employmentId")), rateType: String(formData.get("rateType")) as "HOURLY" | "DAILY" | "WEEKLY" | "SALARY", amount: Number(formData.get("amount")), currency: String(formData.get("currency")).toUpperCase(), effectiveFrom: dateValue(formData, "effectiveFrom") });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "No fue posible cambiar la tarifa.";
  }
  if (error) redirect(`/administration/workforce/employees/${encodeURIComponent(employeeId)}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
}

export async function changeWorkforceEmploymentStatusAction(formData: FormData) {
  await authorize();
  await changeEmploymentStatus({ employmentId: String(formData.get("employmentId")), status: String(formData.get("status")) as "ACTIVE" | "INACTIVE" | "TERMINATED", effectiveAt: dateValue(formData, "effectiveAt"), terminationReason: String(formData.get("terminationReason") ?? "") || null });
  revalidatePath(`/administration/workforce/employees/${String(formData.get("employeeId"))}`);
}
