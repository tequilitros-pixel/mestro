"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessibleBranchIds, requireModuleAccess } from "@/lib/auth";
import { workforceV1Enabled } from "@/lib/workforce/config";
import {
  copyPreviousScheduleWeek,
  createOrUpdateShift,
  deleteOrCancelShift,
  ensureSchedulePeriod,
  publishSchedulePeriod,
  upsertStaffingRequirement,
  type SchedulingActor,
} from "@/lib/workforce/scheduling/service";

async function actor(): Promise<SchedulingActor> {
  if (!workforceV1Enabled())
    throw new Error("Workforce V1 no está habilitado.");
  const user = await requireModuleAccess("/administration/schedule");
  if (!["ADMIN", "GERENTE", "ENCARGADO"].includes(user.role))
    throw new Error("No autorizado para Scheduling V1.");
  return {
    id: user.id,
    role: user.role,
    accessibleBranchIds: await getAccessibleBranchIds(),
  };
}
function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
function date(formData: FormData, key: string) {
  const raw = value(formData, key);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!raw || Number.isNaN(parsed.getTime()))
    throw new Error(`Fecha inválida: ${key}`);
  return parsed;
}
function route(formData: FormData) {
  const target = value(formData, "returnTo");
  return target.startsWith("/administration/workforce/schedule")
    ? target
    : "/administration/workforce/schedule";
}
function resultRoute(target: string, key: "saved" | "error", message: string) {
  return `${target}${target.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`;
}
async function run(
  formData: FormData,
  operation: (current: SchedulingActor) => Promise<string>,
) {
  const target = route(formData);
  let destination: string;
  try {
    destination = resultRoute(target, "saved", await operation(await actor()));
  } catch (error) {
    destination = resultRoute(
      target,
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible completar la acción.",
    );
  }
  redirect(destination);
}

export async function ensureWorkforceSchedulePeriodAction(formData: FormData) {
  await run(formData, async (current) => {
    await ensureSchedulePeriod(
      current,
      value(formData, "branchId"),
      date(formData, "weekStart"),
    );
    return "Semana borrador lista.";
  });
}
export async function saveWorkforceShiftAction(formData: FormData) {
  await run(formData, async (current) => {
    await createOrUpdateShift(current, {
      periodId: value(formData, "periodId"),
      shiftId: value(formData, "shiftId") || undefined,
      expectedVersion: value(formData, "expectedVersion")
        ? Number(value(formData, "expectedVersion"))
        : undefined,
      employmentId: value(formData, "employmentId") || null,
      businessDate: date(formData, "businessDate"),
      startTime: value(formData, "startTime"),
      endTime: value(formData, "endTime"),
      expectedBreakMinutes: Number(
        value(formData, "expectedBreakMinutes") || 0,
      ),
      reason: value(formData, "reason") || null,
    });
    revalidatePath("/administration/workforce/schedule");
    revalidatePath("/workforce");
    return "Turno guardado.";
  });
}
export async function deleteWorkforceShiftAction(formData: FormData) {
  await run(formData, async (current) => {
    const result = await deleteOrCancelShift(current, {
      shiftId: value(formData, "shiftId"),
      expectedVersion: Number(value(formData, "expectedVersion")),
      reason: value(formData, "reason") || null,
    });
    revalidatePath("/administration/workforce/schedule");
    revalidatePath("/workforce");
    return result.deleted
      ? "Borrador eliminado."
      : "Turno cancelado con historia.";
  });
}
export async function publishWorkforceScheduleAction(formData: FormData) {
  await run(formData, async (current) => {
    const result = await publishSchedulePeriod(
      current,
      value(formData, "periodId"),
    );
    revalidatePath("/administration/workforce/schedule");
    revalidatePath("/workforce");
    return result.idempotent
      ? "La semana ya estaba publicada."
      : "Semana publicada.";
  });
}
export async function copyWorkforcePreviousWeekAction(formData: FormData) {
  await run(formData, async (current) => {
    const result = await copyPreviousScheduleWeek(
      current,
      value(formData, "periodId"),
    );
    revalidatePath("/administration/workforce/schedule");
    if (result.idempotent)
      return "La semana ya contiene turnos; no se crearon duplicados.";
    return `${result.copied} shifts copiados; ${result.skipped} omitidos.`;
  });
}
export async function saveWorkforceCoverageAction(formData: FormData) {
  await run(formData, async (current) => {
    await upsertStaffingRequirement(current, {
      branchId: value(formData, "branchId"),
      businessDate: date(formData, "businessDate"),
      startTime: value(formData, "startTime"),
      endTime: value(formData, "endTime"),
      requiredCount: Number(value(formData, "requiredCount")),
    });
    revalidatePath("/administration/workforce/schedule");
    return "Cobertura guardada.";
  });
}
