"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createWorkforcePolicyVersion } from "@/lib/workforce/settings/service";

const path = "/administration/workforce-v1/settings";
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const integer = (form: FormData, key: string) => Number(text(form, key));
const checked = (form: FormData, key: string) => form.get(key) === "on";

export async function createWorkforceSettingsVersionAction(form: FormData) {
  try {
    const user = await requireAdmin();
    await createWorkforcePolicyVersion(
      { id: user.id, role: user.role },
      {
        effectiveFrom: new Date(`${text(form, "effectiveFrom")}T00:00:00.000Z`),
        reason: text(form, "reason"),
        confirmLegalChange: checked(form, "confirmLegalChange"),
        companyTimezone: text(form, "companyTimezone"),
        payWeekStartsOn: 1,
        payDay: integer(form, "payDay"),
        scheduledHoursWarningMinutes: integer(form, "scheduledHoursWarningHours") * 60,
        preventiveOvertimeWarningMinutes: integer(form, "preventiveOvertimeWarningHours") * 60,
        allowUnassignedShiftPublication: checked(form, "allowUnassignedShiftPublication"),
        allowAvailabilityWarningPublication: checked(form, "allowAvailabilityWarningPublication"),
        allowUnscheduledWork: checked(form, "allowUnscheduledWork"),
        shiftLinkProximityMinutes: integer(form, "shiftLinkProximityMinutes"),
        lateGraceMinutes: integer(form, "lateGraceMinutes"),
        earlyDepartureGraceMinutes: integer(form, "earlyDepartureGraceMinutes"),
        longBreakThresholdMinutes: integer(form, "longBreakThresholdMinutes"),
        noShowThresholdMinutes: integer(form, "noShowThresholdMinutes"),
        missingClockOutThresholdMinutes: integer(form, "missingClockOutThresholdMinutes"),
        legalDayOrdinaryLimitMinutes: integer(form, "legalDayOrdinaryLimitMinutes"),
        legalNightOrdinaryLimitMinutes: integer(form, "legalNightOrdinaryLimitMinutes"),
        legalMixedOrdinaryLimitMinutes: integer(form, "legalMixedOrdinaryLimitMinutes"),
        legalWeeklyDoubleLimitMinutes: integer(form, "legalWeeklyDoubleLimitMinutes"),
      },
    );
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${path}?error=${encodeURIComponent(error instanceof Error ? error.message : "Configuración inválida.")}`);
  }
  redirect(`${path}?saved=${encodeURIComponent("Nueva versión programada.")}`);
}
