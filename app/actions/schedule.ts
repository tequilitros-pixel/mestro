"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPayrollSettings } from "@/app/actions/overtime";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";

/**
 * Si la semana de `dateStr` todavía no tiene ninguna fila en
 * ScheduleWeek Y todavía no tiene ningún turno registrado, se crea
 * como BORRADOR antes de meter el primer turno. Así toda semana nueva
 * arranca oculta para los empleados hasta que el admin la publique.
 *
 * Las semanas que ya tenían turnos antes de que existiera este
 * concepto de publicación (o cualquier semana donde el admin nunca
 * publicó/despublicó) se quedan sin fila — y por default se siguen
 * mostrando como visibles (ver getMyScheduleForWeeks), para no
 * esconderle de golpe a nadie algo que ya podía ver.
 */
async function ensureWeekStartsAsDraftIfEmpty(
  tx: Prisma.TransactionClient,
  dateStr: string,
) {
  const weekStartStr = mondayOfWeek(dateStr);
  const weekStart = parseDateOnly(weekStartStr);

  const existingWeekRow = await tx.scheduleWeek.findUnique({ where: { weekStart } });
  if (existingWeekRow) return;

  const weekEnd = parseDateOnly(addDaysToDateOnly(weekStartStr, 7));
  const anyShiftThisWeek = await tx.scheduledShift.count({
    where: { date: { gte: weekStart, lt: weekEnd } },
  });

  if (anyShiftThisWeek === 0) {
    await tx.scheduleWeek.create({ data: { weekStart, status: "DRAFT" } });
  }
}

/**
 * Datos completos para la cuadrícula semanal de Horario: empleados
 * (con su costo por hora), sucursales (con su color), turnos y
 * descansos de la semana, plantillas para autocompletar horas, y el
 * estado de publicación de la semana.
 */
export async function getScheduleGridForWeek(weekStart: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const mondayStr = mondayOfWeek(weekStart);
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));

  const [shifts, employees, branches, templates, weekRow, payrollSettings] = await Promise.all([
    prisma.scheduledShift.findMany({
      where: { date: { gte: start, lt: end } },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, hourlyRate: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchScheduleTemplate.findMany({ where: { active: true } }),
    prisma.scheduleWeek.findUnique({ where: { weekStart: start } }),
    getPayrollSettings(),
  ]);

  return {
    success: true,
    weekStart: start,
    weekEnd: end,
    status: weekRow?.status ?? "PUBLISHED",
    publishedAt: weekRow?.publishedAt ?? null,
    weeklyHourThreshold: payrollSettings.weeklyHourThreshold,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      hourlyRate: e.hourlyRate !== null ? Number(e.hourlyRate) : null,
    })),
    branches,
    shifts,
    templates,
  };
}

type UpsertShiftInput = {
  id?: string;
  userId: string;
  date: string;
  type?: "TURNO" | "DESCANSO";
  branchId?: string;
  startTime?: string;
  endTime?: string;
  position?: string;
  notes?: string;
};

/**
 * Crea o edita (si viene `id`) un turno o descanso de la cuadrícula.
 * DESCANSO ignora sucursal y horas aunque vengan en el input.
 */
export async function upsertScheduledShiftAction(input: UpsertShiftInput) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (!input.userId || !input.date) {
    return { error: "Faltan datos del turno" };
  }

  const type = input.type ?? "TURNO";

  if (type === "TURNO" && (!input.branchId || !input.startTime || !input.endTime)) {
    return { error: "Un turno necesita sucursal, hora de entrada y hora de salida." };
  }

  const data = {
    userId: input.userId,
    date: parseDateOnly(input.date),
    type,
    branchId: type === "TURNO" ? input.branchId! : null,
    startTime: type === "TURNO" ? input.startTime! : null,
    endTime: type === "TURNO" ? input.endTime! : null,
    position: input.position?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  await prisma.$transaction(async (tx) => {
    if (!input.id) {
      await ensureWeekStartsAsDraftIfEmpty(tx, input.date);
      await tx.scheduledShift.create({ data });
    } else {
      await tx.scheduledShift.update({ where: { id: input.id }, data });
    }
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

/**
 * Duplica un turno existente a otras fechas (mismo empleado, sucursal,
 * horas, puesto y notas). Sirve tanto para "duplicar a otro día" como
 * para copiar un turno suelto a varios días de una sola vez.
 */
export async function duplicateShiftAction(shiftId: string, targetDates: string[]) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const dates = Array.from(new Set(targetDates.filter(Boolean)));

  if (dates.length === 0) {
    return { error: "Selecciona al menos una fecha destino." };
  }

  const source = await prisma.scheduledShift.findUnique({ where: { id: shiftId } });

  if (!source) {
    return { error: "Turno no encontrado" };
  }

  await prisma.$transaction(async (tx) => {
    for (const dateStr of dates) {
      await ensureWeekStartsAsDraftIfEmpty(tx, dateStr);
    }

    for (const dateStr of dates) {
      await tx.scheduledShift.create({
        data: {
          userId: source.userId,
          branchId: source.branchId,
          date: parseDateOnly(dateStr),
          type: source.type,
          startTime: source.startTime,
          endTime: source.endTime,
          position: source.position,
          notes: source.notes,
        },
      });
    }
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true, count: dates.length };
}

/** Marca la semana como oficial: los empleados pueden verla. */
export async function publishWeekAction(weekStart: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const start = parseDateOnly(mondayOfWeek(weekStart));

  await prisma.scheduleWeek.upsert({
    where: { weekStart: start },
    update: { status: "PUBLISHED", publishedAt: new Date(), publishedById: admin.id },
    create: { weekStart: start, status: "PUBLISHED", publishedAt: new Date(), publishedById: admin.id },
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

/** Regresa la semana a borrador (por si hay que corregir algo antes de que la vea el equipo). */
export async function unpublishWeekAction(weekStart: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const start = parseDateOnly(mondayOfWeek(weekStart));

  await prisma.scheduleWeek.upsert({
    where: { weekStart: start },
    update: { status: "DRAFT" },
    create: { weekStart: start, status: "DRAFT" },
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

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

  await prisma.$transaction(async (tx) => {
    await ensureWeekStartsAsDraftIfEmpty(tx, input.date);

    await tx.scheduledShift.create({
      data: {
        userId: input.userId,
        branchId: input.branchId,
        date: new Date(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        notes: input.notes || null,
      },
    });
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

  await prisma.$transaction(async (tx) => {
    await ensureWeekStartsAsDraftIfEmpty(tx, currentMondayStr);

    await tx.scheduledShift.createMany({
      data: previousShifts.map((shift) => {
        const newDate = parseDateOnly(
          addDaysToDateOnly(formatDateOnly(shift.date), 7)
        );
        return {
          userId: shift.userId,
          branchId: shift.branchId,
          date: newDate,
          type: shift.type,
          startTime: shift.startTime,
          endTime: shift.endTime,
          position: shift.position,
          notes: shift.notes,
        };
      }),
    });
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

/**
 * Turnos del propio empleado para su calendario. Solo se muestran
 * turnos de tipo TURNO (no DESCANSO, que aún no se despliega ahí) y
 * cuya semana esté publicada. Si una semana no tiene fila en
 * ScheduleWeek todavía (turnos creados antes de este feature, o el
 * admin nunca la marcó como borrador), se trata como publicada para
 * no ocultarle a nadie algo que ya podía ver.
 */
export async function getMyScheduleForWeeks(weeksAhead: number = 3) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };

  const todayStr = todayDateOnly();
  const today = parseDateOnly(todayStr);
  const end = parseDateOnly(addDaysToDateOnly(todayStr, weeksAhead * 7));

  const [shifts, weeks] = await Promise.all([
    prisma.scheduledShift.findMany({
      where: {
        userId: user.id,
        type: "TURNO",
        date: { gte: today, lt: end },
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.scheduleWeek.findMany({
      where: { weekStart: { gte: parseDateOnly(mondayOfWeek(todayStr)), lt: end } },
      select: { weekStart: true, status: true },
    }),
  ]);

  const weekStatus = new Map(
    weeks.map((w) => [formatDateOnly(w.weekStart), w.status]),
  );

  const visible = shifts.filter((s) => {
    if (!s.branch || !s.startTime || !s.endTime) return false;
    const monday = mondayOfWeek(formatDateOnly(s.date));
    const status = weekStatus.get(monday);
    return status !== "DRAFT";
  });

  return {
    success: true,
    shifts: visible.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime as string,
      endTime: s.endTime as string,
      notes: s.notes,
      branch: s.branch as { id: string; name: string },
    })),
  };
}
