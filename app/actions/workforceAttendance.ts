"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { decideAttendanceException } from "@/lib/workforce/attendance/mutations";

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const attendancePath = "/administration/workforce-v1/attendance";

export async function workforceAttendanceDecisionAction(form: FormData) {
  const actor = await requireAdmin();
  try {
    await decideAttendanceException(actor, {
      exceptionId: value(form, "exceptionId"),
      decision: value(form, "decision") as "RESOLVED" | "DISMISSED",
      resolution: value(form, "resolution"),
    });
    revalidatePath(attendancePath);
  } catch (error) {
    unstable_rethrow(error);
    redirect(
      `${attendancePath}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "No se pudo resolver.",
      )}`,
    );
  }
  redirect(
    `${attendancePath}?saved=${encodeURIComponent("Excepción actualizada.")}`,
  );
}
