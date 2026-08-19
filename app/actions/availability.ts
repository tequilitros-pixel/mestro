"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addDaysToDateOnly, formatDateOnly, mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";
import { isPayrollDateLocked, PAYROLL_LOCKED_MESSAGE } from "@/lib/payroll/periodLock";

export type AvailabilityKind = "AVAILABLE_ALL_DAY" | "AVAILABLE_PARTIAL" | "UNAVAILABLE" | "PREFER_OFF";
export type AvailabilityReasonKind = "MEDICAL" | "SCHOOL" | "FAMILY" | "TRAVEL" | "ERRAND" | "OTHER";

const VALID_TYPES = new Set<AvailabilityKind>(["AVAILABLE_ALL_DAY", "AVAILABLE_PARTIAL", "UNAVAILABLE", "PREFER_OFF"]);
const VALID_REASONS = new Set<AvailabilityReasonKind>(["MEDICAL", "SCHOOL", "FAMILY", "TRAVEL", "ERRAND", "OTHER"]);

function dayIndex(date: string) {
  const day = parseDateOnly(date).getUTCDay();
  return (day + 6) % 7;
}

async function getSettings() {
  return prisma.availabilitySettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

async function isAvailabilityClosed(date: string) {
  const settings = await getSettings();
  const targetMonday = mondayOfWeek(date);
  const deadlineDate = addDaysToDateOnly(targetMonday, settings.deadlineWeekday - 7);
  const deadline = new Date(`${deadlineDate}T${settings.deadlineTime}:00-06:00`);
  return { closed: new Date() > deadline, settings };
}

export async function getMyAvailabilityWeek(weekStartInput: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" } as const;

  const weekStart = mondayOfWeek(weekStartInput);
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDaysToDateOnly(weekStart, 7));
  const [rules, exceptions, shifts, weekRow, deadline] = await Promise.all([
    prisma.employeeAvailabilityRule.findMany({ where: { userId: user.id, active: true } }),
    prisma.employeeAvailabilityException.findMany({ where: { userId: user.id, date: { gte: start, lt: end } } }),
    prisma.scheduledShift.findMany({
      where: { userId: user.id, type: "TURNO", date: { gte: start, lt: end } },
      select: { id: true, date: true, startTime: true, endTime: true, branch: { select: { name: true } } },
    }),
    prisma.scheduleWeek.findUnique({ where: { weekStart: start }, select: { status: true } }),
    isAvailabilityClosed(weekStart),
  ]);

  const ruleByDay = new Map(rules.map((rule) => [rule.dayOfWeek, rule]));
  const exceptionByDate = new Map(exceptions.map((item) => [formatDateOnly(item.date), item]));
  const shiftsByDate = new Map(shifts.map((shift) => [formatDateOnly(shift.date), shift]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateOnly(weekStart, index);
    const exception = exceptionByDate.get(date);
    const rule = ruleByDay.get(index);
    const effective = exception ?? rule ?? null;
    return {
      date,
      source: exception ? "EXCEPTION" as const : rule ? "RECURRING" as const : "NONE" as const,
      availability: effective ? {
        type: effective.type as AvailabilityKind,
        startTime: effective.startTime,
        endTime: effective.endTime,
        reason: effective.reason as AvailabilityReasonKind | null,
        reasonNotes: effective.reasonNotes,
      } : null,
      shift: shiftsByDate.get(date) ?? null,
    };
  });

  return {
    success: true as const,
    weekStart,
    days,
    closed: deadline.closed,
    published: weekRow?.status === "PUBLISHED",
    deadline: { weekday: deadline.settings.deadlineWeekday, time: deadline.settings.deadlineTime },
  };
}

export async function saveMyAvailabilityAction(input: {
  date: string;
  type: AvailabilityKind;
  startTime?: string;
  endTime?: string;
  reason?: AvailabilityReasonKind;
  reasonNotes?: string;
  repeatWeekly?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !VALID_TYPES.has(input.type)) return { error: "Datos de disponibilidad no válidos." };
  if (input.type === "AVAILABLE_PARTIAL" && (!input.startTime || !input.endTime)) return { error: "Indica el horario disponible." };
  if (input.reason && !VALID_REASONS.has(input.reason)) return { error: "Motivo no válido." };
  if (await isPayrollDateLocked(input.date)) return { error: PAYROLL_LOCKED_MESSAGE };

  const deadline = await isAvailabilityClosed(input.date);
  if (deadline.closed) return { error: "El periodo de disponibilidad para esta semana ya cerró." };

  if (input.type === "UNAVAILABLE") {
    const weekStart = parseDateOnly(mondayOfWeek(input.date));
    const week = await prisma.scheduleWeek.findUnique({ where: { weekStart }, select: { status: true } });
    const shift = await prisma.scheduledShift.findFirst({
      where: { userId: user.id, type: "TURNO", date: parseDateOnly(input.date) },
      select: { id: true },
    });
    if (shift && week?.status === "PUBLISHED") {
      return { error: "Ya tienes un turno programado para este día. Consulta tu horario y solicita un cambio." };
    }
  }

  const data = {
    type: input.type,
    startTime: input.type === "AVAILABLE_PARTIAL" ? input.startTime! : null,
    endTime: input.type === "AVAILABLE_PARTIAL" ? input.endTime! : null,
    reason: input.type === "UNAVAILABLE" && input.reason ? input.reason : null,
    reasonNotes: input.type === "UNAVAILABLE" ? input.reasonNotes?.trim() || null : null,
  };

  if (input.repeatWeekly) {
    await prisma.employeeAvailabilityRule.upsert({
      where: { userId_dayOfWeek: { userId: user.id, dayOfWeek: dayIndex(input.date) } },
      update: { ...data, active: true },
      create: { userId: user.id, dayOfWeek: dayIndex(input.date), ...data },
    });
  } else {
    await prisma.employeeAvailabilityException.upsert({
      where: { userId_date: { userId: user.id, date: parseDateOnly(input.date) } },
      update: data,
      create: { userId: user.id, date: parseDateOnly(input.date), ...data },
    });
  }

  revalidatePath("/timeclock/availability");
  revalidatePath("/administration/schedule");
  return { success: true };
}

export async function copyPreviousAvailabilityWeekAction(weekStartInput: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };
  const weekStart = mondayOfWeek(weekStartInput);
  const deadline = await isAvailabilityClosed(weekStart);
  if (deadline.closed) return { error: "El periodo de disponibilidad para esta semana ya cerró." };

  const previousStart = addDaysToDateOnly(weekStart, -7);
  const previous = await getMyAvailabilityWeek(previousStart);
  if (previous.success !== true || !previous.days) return { error: "No fue posible consultar la semana anterior." };

  const rows = previous.days.filter((day) => day.availability).map((day, index) => ({
    userId: user.id,
    date: parseDateOnly(addDaysToDateOnly(weekStart, index)),
    type: day.availability!.type,
    startTime: day.availability!.startTime,
    endTime: day.availability!.endTime,
    reason: day.availability!.reason,
    reasonNotes: day.availability!.reasonNotes,
  }));
  await prisma.$transaction(rows.map((row) => prisma.employeeAvailabilityException.upsert({
    where: { userId_date: { userId: row.userId, date: row.date } }, update: row, create: row,
  })));
  revalidatePath("/timeclock/availability");
  return { success: true, count: rows.length };
}
