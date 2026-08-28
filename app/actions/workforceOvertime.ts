"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { finalizeOvertime, setEmploymentJornadaPolicy } from "@/lib/workforce/overtime/service";

const path = "/administration/workforce-v1/overtime";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const back = (form: FormData) => {
  const candidate = value(form, "returnTo");
  return candidate.startsWith(path) ? candidate : path;
};
const finish = (destination: string, key: "saved" | "error", message: string): never =>
  redirect(`${destination}${destination.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`);

export async function finalizeWorkforceOvertimeAction(form: FormData) {
  const destination = back(form);
  try {
    const user = await requireAdmin();
    await finalizeOvertime(
      { id: user.id, role: user.role },
      { timesheetId: value(form, "timesheetId"), expectedTimesheetVersion: Number(value(form, "expectedTimesheetVersion")) },
    );
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    finish(destination, "error", error instanceof Error ? error.message : "No se pudo finalizar.");
  }
  finish(destination, "saved", "Clasificación de overtime finalizada.");
}

export async function setWorkforceJornadaAction(form: FormData) {
  const destination = back(form);
  try {
    const user = await requireAdmin();
    await setEmploymentJornadaPolicy(
      { id: user.id, role: user.role },
      {
        employmentId: value(form, "employmentId"),
        jornadaType: value(form, "jornadaType") as "DAY" | "NIGHT" | "MIXED",
        effectiveFrom: new Date(`${value(form, "effectiveFrom")}T00:00:00.000Z`),
      },
    );
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    finish(destination, "error", error instanceof Error ? error.message : "Jornada inválida.");
  }
  finish(destination, "saved", "Jornada efectiva registrada.");
}
