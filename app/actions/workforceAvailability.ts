"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { workforceV1Enabled } from "@/lib/workforce/config";
import { deleteAvailabilityException, saveAvailabilityException, saveAvailabilityRule } from "@/lib/workforce/availability/service";

async function actor() {
  if (!workforceV1Enabled()) throw new Error("Workforce V1 no está habilitado.");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return { id: user.id, role: user.role };
}

function date(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`Fecha inválida: ${key}`);
  return parsed;
}

function time(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim() || null; }

function destination(formData: FormData, attention: { required: boolean }) {
  const returnTo = String(formData.get("returnTo") ?? "/workforce-v1/availability");
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1${attention.required ? "&attention=1" : ""}`;
}

export async function saveWorkforceAvailabilityRuleAction(formData: FormData) {
  const current = await actor();
  const attention = await saveAvailabilityRule(current, { employeeId: String(formData.get("employeeId")), dayOfWeek: Number(formData.get("dayOfWeek")), state: String(formData.get("state")) as "AVAILABLE" | "UNAVAILABLE", startTime: time(formData, "startTime"), endTime: time(formData, "endTime"), effectiveFrom: date(formData, "effectiveFrom") });
  revalidatePath("/workforce-v1/availability");
  revalidatePath("/administration/workforce-v1/availability");
  redirect(destination(formData, attention));
}

export async function saveWorkforceAvailabilityExceptionAction(formData: FormData) {
  const current = await actor();
  const attention = await saveAvailabilityException(current, { employeeId: String(formData.get("employeeId")), date: date(formData, "date"), state: String(formData.get("state")) as "AVAILABLE" | "UNAVAILABLE", startTime: time(formData, "startTime"), endTime: time(formData, "endTime"), reason: String(formData.get("reason") ?? "").trim() || null });
  revalidatePath("/workforce-v1/availability");
  revalidatePath("/administration/workforce-v1/availability");
  redirect(destination(formData, attention));
}

export async function deleteWorkforceAvailabilityExceptionAction(formData: FormData) {
  const current = await actor();
  const attention = await deleteAvailabilityException(current, String(formData.get("employeeId")), date(formData, "date"));
  revalidatePath("/workforce-v1/availability");
  revalidatePath("/administration/workforce-v1/availability");
  redirect(destination(formData, attention));
}
