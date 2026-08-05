"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";

export async function getScheduleForWeek(weekStart: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const mondayStr = mondayOfWeek(weekStart);
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));

  const [shifts, users, branches, templates] = await Promise.all([
    prisma.scheduledShift.findMany({
      where: { date: { gte: start, lt: end } },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchScheduleTemplate.findMany({
      where: { active: true },
    }),
  ]);

  return { success: true, weekStart: start, shifts, users, branches, templates };
}

export async function createScheduledShiftAction(input: {
  userId: string;
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (!input.userId || !input.branchId || !input.date || !input.startTime || !input.endTime) {
    return { error: "Faltan datos del turno" };
  }

  await prisma.scheduledShift.create({
    data: {
      userId: input.userId,
      branchId: input.branchId,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      notes: input.notes || null,
    },
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

export async function deleteScheduledShiftAction(shiftId: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  await prisma.scheduledShift.delete({ where: { id: shiftId } });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

export async function copyPreviousWeekAction(weekStart: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const currentMondayStr = mondayOfWeek(weekStart);
  const previousMondayStr = addDaysToDateOnly(currentMondayStr, -7);
  const previousStart = parseDateOnly(previousMondayStr);
  const previousEnd = parseDateOnly(currentMondayStr);

  const previousShifts = await prisma.scheduledShift.findMany({
    where: { date: { gte: previousStart, lt: previousEnd } },
  });

  if (previousShifts.length === 0) {
    return { error: "No hay turnos en la semana anterior para copiar." };
  }

  await prisma.scheduledShift.createMany({
    data: previousShifts.map((shift) => {
      const newDate = parseDateOnly(
        addDaysToDateOnly(formatDateOnly(shift.date), 7)
      );
      return {
        userId: shift.userId,
        branchId: shift.branchId,
        date: newDate,
        startTime: shift.startTime,
        endTime: shift.endTime,
        notes: shift.notes,
      };
    }),
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true, count: previousShifts.length };
}

export async function getBranchScheduleTemplates() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const [branches, templates] = await Promise.all([
    prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchScheduleTemplate.findMany({
      orderBy: [{ branchId: "asc" }, { dayOfWeek: "asc" }],
    }),
  ]);

  return { success: true, branches, templates };
}

export async function upsertBranchScheduleTemplateAction(input: {
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (
    !input.branchId ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6 ||
    !input.startTime ||
    !input.endTime
  ) {
    return { error: "Faltan datos de la plantilla" };
  }

  await prisma.branchScheduleTemplate.upsert({
    where: {
      branchId_dayOfWeek: {
        branchId: input.branchId,
        dayOfWeek: input.dayOfWeek,
      },
    },
    update: {
      startTime: input.startTime,
      endTime: input.endTime,
      active: true,
    },
    create: {
      branchId: input.branchId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });

  revalidatePath("/administration/schedule");

  return { success: true };
}

export async function clearBranchScheduleTemplateAction(input: {
  branchId: string;
  dayOfWeek: number;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  await prisma.branchScheduleTemplate.deleteMany({
    where: {
      branchId: input.branchId,
      dayOfWeek: input.dayOfWeek,
    },
  });

  revalidatePath("/administration/schedule");

  return { success: true };
}

export async function getMyScheduleForWeeks(weeksAhead: number = 3) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };

  const todayStr = todayDateOnly();
  const today = parseDateOnly(todayStr);
  const end = parseDateOnly(addDaysToDateOnly(todayStr, weeksAhead * 7));

  const shifts = await prisma.scheduledShift.findMany({
    where: {
      userId: user.id,
      date: { gte: today, lt: end },
    },
    include: {
      branch: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  return { success: true, shifts };
}
