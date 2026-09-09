"use server";
import bcrypt from "bcryptjs";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decideCorrection,
  applyAdminClockCorrection,
  recordClockEvent,
  requestCorrection,
  resolveOwnActiveEmployment,
} from "@/lib/workforce/clock/service";
import type { ClockType } from "@/lib/workforce/clock/effectiveStream";
import { parseLocalDateTimeInZone } from "@/lib/workforce/clock/localDateTime";

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const safe = (path: string) =>
  path.startsWith("/workforce") ||
  path.startsWith("/administration/workforce")
    ? path
    : "/workforce/clock";
async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return { id: user.id, role: user.role };
}
function done(path: string, key: "saved" | "error", message: string): never {
  const destination = safe(path);
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}${key}=${encodeURIComponent(message)}`);
}
async function correctionTimezone(form: FormData) {
  const branchId = value(form, "branchId");
  if (branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { timezone: true },
    });
    if (branch?.timezone) return branch.timezone;
  }
  const targetClockEventId = value(form, "targetClockEventId");
  if (targetClockEventId) {
    const event = await prisma.clockEvent.findUnique({
      where: { id: targetClockEventId },
      select: { timezone: true },
    });
    if (event?.timezone) return event.timezone;
  }
  return "America/Mexico_City";
}
export async function workforceClockAction(form: FormData) {
  const current = await actor();
  const back = value(form, "returnTo");
  try {
    const employment = await resolveOwnActiveEmployment(current);
    const result = await recordClockEvent(current, {
      employmentId: employment.id,
      branchId: value(form, "branchId"),
      type: value(form, "type") as ClockType,
      source: "PERSONAL",
      idempotencyKey: value(form, "idempotencyKey"),
    });
    revalidatePath("/workforce/clock");
    done(
      back,
      "saved",
      result.idempotent ? "Operación ya registrada." : "Evento registrado.",
    );
  } catch (error) {
    unstable_rethrow(error);
    done(
      back,
      "error",
      error instanceof Error ? error.message : "No se pudo registrar.",
    );
  }
}
export async function workforceCorrectionRequestAction(form: FormData) {
  const current = await actor();
  const back = value(form, "returnTo");
  try {
    const proposedOccurredAt = value(form, "proposedOccurredAt");
    await requestCorrection(current, {
      type: value(form, "type") as
        "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT",
      targetClockEventId: value(form, "targetClockEventId") || null,
      targetCorrectionId: value(form, "targetCorrectionId") || null,
      branchId: value(form, "branchId") || null,
      proposedEventType: (value(form, "proposedEventType") ||
        null) as ClockType | null,
      proposedOccurredAt: proposedOccurredAt
        ? parseLocalDateTimeInZone(proposedOccurredAt, await correctionTimezone(form))
        : null,
      reason: value(form, "reason"),
    });
    done(back, "saved", "Solicitud enviada.");
  } catch (error) {
    unstable_rethrow(error);
    done(
      back,
      "error",
      error instanceof Error ? error.message : "Solicitud inválida.",
    );
  }
}

export async function workforceAdminClockCorrectionAction(form: FormData) {
  const current = await actor();
  const back = value(form, "returnTo");
  try {
    const proposedOccurredAt = value(form, "proposedOccurredAt");
    await applyAdminClockCorrection(current, {
      employmentId: value(form, "employmentId"),
      type: value(form, "type") as "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT",
      targetClockEventId: value(form, "targetClockEventId") || null,
      branchId: value(form, "branchId") || null,
      proposedEventType: (value(form, "proposedEventType") || null) as ClockType | null,
      proposedOccurredAt: proposedOccurredAt
        ? parseLocalDateTimeInZone(proposedOccurredAt, await correctionTimezone(form))
        : null,
      reason: value(form, "reason"),
    });
    revalidatePath("/administration/workforce/timesheets");
    revalidatePath("/administration/workforce/attendance");
    done(back, "saved", "Corrección aplicada y enviada al cálculo de horas.");
  } catch (error) {
    unstable_rethrow(error);
    done(back, "error", error instanceof Error ? error.message : "No se pudo aplicar la corrección.");
  }
}

export async function workforceCorrectionDecisionAction(form: FormData) {
  const current = await actor();
  const back = value(form, "returnTo");
  try {
    await decideCorrection(current, {
      correctionId: value(form, "correctionId"),
      decision: value(form, "decision") as "APPROVED" | "REJECTED",
      rejectionReason: value(form, "rejectionReason"),
    });
    revalidatePath("/administration/workforce/clock-corrections");
    done(back, "saved", "Decisión guardada.");
  } catch (error) {
    unstable_rethrow(error);
    done(
      back,
      "error",
      error instanceof Error ? error.message : "No se pudo decidir.",
    );
  }
}
export async function workforceKioskClockAction(form: FormData) {
  const host = await actor();
  const back = value(form, "returnTo");
  try {
    const user = await prisma.user.findUnique({
      where: { id: value(form, "userId") },
      include: {
        workforceEmployee: {
          include: { employments: { where: { status: "ACTIVE" } } },
        },
      },
    });
    if (
      !user?.active ||
      !user.pinHash ||
      user.workforceEmployee?.employments.length !== 1
    )
      throw new Error("Empleado no válido.");
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new Error("PIN temporalmente bloqueado.");
    if (!(await bcrypt.compare(value(form, "pin"), user.pinHash))) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null,
        },
      });
      throw new Error("PIN incorrecto.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const dashboard = await import("@/lib/workforce/clock/service").then((m) =>
      m.getClockDashboard({ id: user.id, role: user.role }),
    );
    const type =
      dashboard.state === "NO_SESSION"
        ? "CLOCK_IN"
        : dashboard.state === "ON_BREAK"
          ? "BREAK_END"
          : "CLOCK_OUT";
    const result = await recordClockEvent(
      { id: host.id, role: "ADMIN" },
      {
        employmentId: user.workforceEmployee.employments[0].id,
        branchId: value(form, "branchId"),
        type,
        source: "KIOSK",
        idempotencyKey: value(form, "idempotencyKey"),
      },
    );
    done(
      back,
      "saved",
      result.idempotent ? "Operación ya registrada." : `${user.name}: ${type}`,
    );
  } catch (error) {
    unstable_rethrow(error);
    done(
      back,
      "error",
      error instanceof Error ? error.message : "Kiosk inválido.",
    );
  }
}
