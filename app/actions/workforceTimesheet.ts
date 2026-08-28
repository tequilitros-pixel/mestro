"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  addTimesheetAdjustment,
  approveTimesheet,
  lockTimesheet,
} from "@/lib/workforce/timesheet/service";

const path = "/administration/workforce-v1/timesheets";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const actor = async () => {
  const user = await requireAdmin();
  return { id: user.id, role: user.role, accessibleBranchIds: null };
};
const finish = (back: string, key: "saved" | "error", message: string): never => {
  const destination = back.startsWith(path) ? back : path;
  redirect(
    `${destination}${destination.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`,
  );
};

export async function workforceTimesheetAdjustmentAction(form: FormData) {
  const back = value(form, "returnTo");
  try {
    await addTimesheetAdjustment(await actor(), {
      lineId: value(form, "lineId"),
      type: value(form, "type") as "ADD_PAYABLE_TIME" | "REMOVE_PAYABLE_TIME",
      minutes: Number(value(form, "minutes")),
      reason: value(form, "reason"),
      idempotencyKey: value(form, "idempotencyKey"),
      expectedVersion: Number(value(form, "expectedVersion")),
    });
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    finish(back, "error", error instanceof Error ? error.message : "Ajuste inválido.");
  }
  finish(back, "saved", "Ajuste registrado.");
}

export async function workforceTimesheetApprovalAction(form: FormData) {
  const back = value(form, "returnTo");
  try {
    await approveTimesheet(await actor(), {
      timesheetId: value(form, "timesheetId"),
      expectedVersion: Number(value(form, "expectedVersion")),
      idempotencyKey: value(form, "idempotencyKey"),
    });
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    finish(back, "error", error instanceof Error ? error.message : "No se pudo aprobar.");
  }
  finish(back, "saved", "Timesheet aprobado.");
}

export async function workforceTimesheetLockAction(form: FormData) {
  const back = value(form, "returnTo");
  try {
    await lockTimesheet(await actor(), {
      timesheetId: value(form, "timesheetId"),
      expectedVersion: Number(value(form, "expectedVersion")),
    });
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    finish(back, "error", error instanceof Error ? error.message : "No se pudo bloquear.");
  }
  finish(back, "saved", "Timesheet bloqueado.");
}
