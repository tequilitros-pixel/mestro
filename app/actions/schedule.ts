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
export async function ensureWeekStartsAsDraftIfEmpty(
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
        event: { select: { id: true, name: true, location: true } },
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

type ShiftIdentityCheck = {
  userId: string;
  date: string;
  type: "TURNO" | "DESCANSO";
  branchId: string | null;
  startTime: string | null;
  endTime: string | null;
  excludeId?: string;
};

/**
 * Busca si ya existe un turno idéntico (mismo empleado, fecha,
 * sucursal y horario) para evitar duplicados accidentales al mover,
 * duplicar o hacer multi-duplicado.
 */
async function findIdenticalShift(check: ShiftIdentityCheck) {
  return prisma.scheduledShift.findFirst({
    where: {
      userId: check.userId,
      date: parseDateOnly(check.date),
      type: check.type,
      branchId: check.branchId,
      startTime: check.startTime,
      endTime: check.endTime,
      ...(check.excludeId ? { id: { not: check.excludeId } } : {}),
    },
    select: { id: true },
  });
}

/**
 * Mueve un turno a otro empleado y/o fecha SIN borrarlo y volverlo a
 * crear (conserva sucursal, horario, puesto, notas y el mismo id).
 *
 * Si el turno ya tiene un fichaje (checada) vinculado, se bloquea: la
 * checada quedaría "apuntando" a un empleado/fecha que ya no
 * corresponde a lo que realmente se trabajó. En ese caso hay que
 * editar o eliminar el turno en vez de moverlo.
 */
export async function moveScheduledShiftAction(
  shiftId: string,
  input: { userId?: string; date?: string },
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (!input.userId && !input.date) {
    return { error: "Indica un empleado y/o una fecha nuevos." };
  }

  const source = await prisma.scheduledShift.findUnique({
    where: { id: shiftId },
    include: { timeClockEntries: { select: { id: true }, take: 1 } },
  });

  if (!source) return { error: "Turno no encontrado" };

  if (source.timeClockEntries.length > 0) {
    return {
      error:
        "Este turno ya tiene un fichaje (checada) registrado — no se puede mover. Edítalo o elimínalo si necesitas corregirlo.",
    };
  }

  const newUserId = input.userId || source.userId;
  const newDateStr = input.date || formatDateOnly(source.date);
  const sourceDateStr = formatDateOnly(source.date);

  if (newUserId === source.userId && newDateStr === sourceDateStr) {
    return { error: "El turno ya está en ese empleado y fecha." };
  }

  const duplicate = await findIdenticalShift({
    userId: newUserId,
    date: newDateStr,
    type: source.type,
    branchId: source.branchId,
    startTime: source.startTime,
    endTime: source.endTime,
    excludeId: source.id,
  });

  if (duplicate) {
    return { error: "Ya existe un turno idéntico en ese empleado y fecha." };
  }

  await prisma.$transaction(async (tx) => {
    await ensureWeekStartsAsDraftIfEmpty(tx, newDateStr);
    await tx.scheduledShift.update({
      where: { id: shiftId },
      data: { userId: newUserId, date: parseDateOnly(newDateStr) },
    });
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

/**
 * Multi-duplicado: crea el mismo turno (sucursal, horario, puesto,
 * notas) para varias combinaciones de empleado + día a la vez. A
 * diferencia de duplicateShiftAction (mismo empleado, varios días),
 * aquí cada destino puede tener un empleado distinto.
 *
 * Salta silenciosamente los destinos donde ya existe un turno
 * idéntico (o que coinciden con el turno origen), para no crear
 * duplicados accidentales; el conteo de saltados se informa al final.
 */
export async function multiDuplicateShiftAction(
  shiftId: string,
  targets: { userId: string; date: string }[],
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const seen = new Set<string>();
  const cleanTargets = targets.filter((t) => {
    if (!t.userId || !t.date) return false;
    const key = `${t.userId}|${t.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (cleanTargets.length === 0) {
    return { error: "Selecciona al menos un empleado y día destino." };
  }

  const source = await prisma.scheduledShift.findUnique({ where: { id: shiftId } });
  if (!source) return { error: "Turno no encontrado" };

  const sourceDateStr = formatDateOnly(source.date);
  const toCreate: { userId: string; date: string }[] = [];
  let skipped = 0;

  for (const target of cleanTargets) {
    if (target.userId === source.userId && target.date === sourceDateStr) {
      skipped += 1;
      continue;
    }

    const duplicate = await findIdenticalShift({
      userId: target.userId,
      date: target.date,
      type: source.type,
      branchId: source.branchId,
      startTime: source.startTime,
      endTime: source.endTime,
    });

    if (duplicate) {
      skipped += 1;
      continue;
    }

    toCreate.push(target);
  }

  if (toCreate.length === 0) {
    return { error: "No se creó ningún turno nuevo: ya existían todos los destinos seleccionados." };
  }

  await prisma.$transaction(async (tx) => {
    const uniqueDates = Array.from(new Set(toCreate.map((t) => t.date)));
    for (const dateStr of uniqueDates) {
      await ensureWeekStartsAsDraftIfEmpty(tx, dateStr);
    }

    await tx.scheduledShift.createMany({
      data: toCreate.map((t) => ({
        userId: t.userId,
        branchId: source.branchId,
        date: parseDateOnly(t.date),
        type: source.type,
        startTime: source.startTime,
        endTime: source.endTime,
        position: source.position,
        notes: source.notes,
      })),
    });
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true, created: toCreate.length, skipped };
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
        event: {
          select: { id: true, name: true, description: true, location: true, instructions: true },
        },
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

  // Un turno normal necesita sucursal; un turno de evento puede no
  // tener sucursal responsable y aun así debe verse (la info viene
  // del evento).
  const visible = shifts.filter((s) => {
    if (!s.startTime || !s.endTime) return false;
    if (!s.branch && !s.event) return false;
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
      position: s.position,
      branch: s.branch as { id: string; name: string } | null,
      event: s.event,
    })),
  };
}
