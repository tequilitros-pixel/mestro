"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureWeekStartsAsDraftIfEmpty } from "@/app/actions/schedule";
import { parseDateOnly } from "@/lib/dateOnly";

/**
 * ==========================================================
 * Eventos puntuales (boda, XV años, feria, servicio de barra, etc.)
 * ----------------------------------------------------------
 * Un ScheduleEvent guarda la info UNA sola vez (nombre, descripción,
 * ubicación, instrucciones); cada empleado asignado tiene su propio
 * ScheduledShift normal (con este evento en `eventId`), así que el
 * checador y la nómina no cambian en nada — siguen viendo turnos.
 *
 * Un evento nunca se guarda como plantilla automáticamente — eso
 * requiere la acción explícita "Guardar como plantilla" sobre la
 * semana, que además ignora a propósito los turnos con eventId.
 * ==========================================================
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

type EventInput = {
  name: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  branchId?: string;
  position?: string;
  instructions?: string;
  internalNotes?: string;
  employeeIds: string[];
};

function validateEventInput(input: EventInput) {
  if (!input.name?.trim()) return "Ponle un nombre al evento.";
  if (!input.date || !input.startTime || !input.endTime) {
    return "Faltan fecha, hora de entrada o hora de salida.";
  }
  if (Array.from(new Set(input.employeeIds.filter(Boolean))).length === 0) {
    return "Asigna al menos un empleado al evento.";
  }
  return null;
}

/** Crea el evento y un ScheduledShift por cada empleado asignado. */
export async function createScheduleEventAction(input: EventInput) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const validationError = validateEventInput(input);
  if (validationError) return { error: validationError };

  const employeeIds = Array.from(new Set(input.employeeIds.filter(Boolean)));

  const eventId = await prisma.$transaction(async (tx) => {
    const event = await tx.scheduleEvent.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        date: parseDateOnly(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location?.trim() || null,
        branchId: input.branchId || null,
        position: input.position?.trim() || null,
        instructions: input.instructions?.trim() || null,
        internalNotes: input.internalNotes?.trim() || null,
        createdById: admin.id,
      },
    });

    await ensureWeekStartsAsDraftIfEmpty(tx, input.date);

    await tx.scheduledShift.createMany({
      data: employeeIds.map((userId) => ({
        userId,
        branchId: input.branchId || null,
        date: parseDateOnly(input.date),
        type: "TURNO" as const,
        startTime: input.startTime,
        endTime: input.endTime,
        position: input.position?.trim() || null,
        eventId: event.id,
      })),
    });

    return event.id;
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true, eventId, count: employeeIds.length };
}

/**
 * Edita un evento y sincroniza a los empleados asignados: los que se
 * quedan reciben la fecha/horario/sucursal/puesto actualizados en su
 * turno, los que se quitan pierden su turno, y los que se agregan
 * reciben uno nuevo.
 */
export async function updateScheduleEventAction(input: EventInput & { eventId: string }) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const validationError = validateEventInput(input);
  if (validationError) return { error: validationError };

  const employeeIds = Array.from(new Set(input.employeeIds.filter(Boolean)));

  const existing = await prisma.scheduleEvent.findUnique({
    where: { id: input.eventId },
    include: { shifts: { select: { id: true, userId: true } } },
  });

  if (!existing) return { error: "Evento no encontrado" };

  const currentIds = new Set(existing.shifts.map((s) => s.userId));
  const nextIds = new Set(employeeIds);
  const toRemove = existing.shifts.filter((s) => !nextIds.has(s.userId)).map((s) => s.id);
  const toAdd = employeeIds.filter((id) => !currentIds.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.scheduleEvent.update({
      where: { id: input.eventId },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        date: parseDateOnly(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location?.trim() || null,
        branchId: input.branchId || null,
        position: input.position?.trim() || null,
        instructions: input.instructions?.trim() || null,
        internalNotes: input.internalNotes?.trim() || null,
      },
    });

    await tx.scheduledShift.updateMany({
      where: { eventId: input.eventId, id: { notIn: toRemove } },
      data: {
        branchId: input.branchId || null,
        date: parseDateOnly(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        position: input.position?.trim() || null,
      },
    });

    if (toRemove.length > 0) {
      await tx.scheduledShift.deleteMany({ where: { id: { in: toRemove } } });
    }

    if (toAdd.length > 0) {
      await ensureWeekStartsAsDraftIfEmpty(tx, input.date);
      await tx.scheduledShift.createMany({
        data: toAdd.map((userId) => ({
          userId,
          branchId: input.branchId || null,
          date: parseDateOnly(input.date),
          type: "TURNO" as const,
          startTime: input.startTime,
          endTime: input.endTime,
          position: input.position?.trim() || null,
          eventId: input.eventId,
        })),
      });
    }
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

/** Elimina el evento y los turnos de todos los empleados asignados. */
export async function deleteScheduleEventAction(eventId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.$transaction(async (tx) => {
    await tx.scheduledShift.deleteMany({ where: { eventId } });
    await tx.scheduleEvent.delete({ where: { id: eventId } });
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true };
}

/** Detalle completo de un evento (para editarlo). */
export async function getScheduleEventDetail(eventId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: eventId },
    include: {
      shifts: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!event) return { error: "Evento no encontrado" };

  return {
    success: true,
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      branchId: event.branchId,
      position: event.position,
      instructions: event.instructions,
      internalNotes: event.internalNotes,
      employees: event.shifts
        .map((s) => s.user)
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

/** Horas entre dos "HH:MM", tolerante a turnos que cruzan medianoche. */
function hoursBetween(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;

  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

function workedHours(entry: { clockIn: Date; clockOut: Date | null }) {
  if (!entry.clockOut) return 0;
  return (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
}

/**
 * Costo de mano de obra del evento: por cada empleado asignado, junta
 * las horas programadas (del turno) contra las horas REALES checadas
 * (TimeClockEntry.scheduledShiftId → ese turno), usando la tarifa por
 * hora vigente del empleado. Es un estimado simple con la tarifa
 * actual, no una integración con el motor de nómina — sirve para ver
 * de un vistazo cuánto costó el evento, no para pagarlo.
 */
export async function getScheduleEventCost(eventId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: eventId },
    include: {
      shifts: {
        include: {
          user: { select: { id: true, name: true, hourlyRate: true } },
          timeClockEntries: { select: { clockIn: true, clockOut: true } },
        },
      },
    },
  });

  if (!event) return { error: "Evento no encontrado" };

  let totalPlannedHours = 0;
  let totalWorkedHours = 0;
  let totalCost = 0;
  let missingRateCount = 0;
  let hasOpenShift = false;

  const employees = event.shifts.map((shift) => {
    const plannedHours =
      shift.startTime && shift.endTime ? hoursBetween(shift.startTime, shift.endTime) : 0;

    let employeeWorkedHours = 0;
    for (const entry of shift.timeClockEntries) {
      if (!entry.clockOut) {
        hasOpenShift = true;
        continue;
      }
      employeeWorkedHours += workedHours(entry);
    }

    const hourlyRate = shift.user.hourlyRate !== null ? Number(shift.user.hourlyRate) : null;
    const cost = hourlyRate !== null ? employeeWorkedHours * hourlyRate : null;

    totalPlannedHours += plannedHours;
    totalWorkedHours += employeeWorkedHours;
    if (cost !== null) totalCost += cost;
    else missingRateCount += 1;

    return {
      id: shift.user.id,
      name: shift.user.name,
      plannedHours,
      workedHours: employeeWorkedHours,
      hourlyRate,
      cost,
    };
  });

  employees.sort((a, b) => a.name.localeCompare(b.name));

  return {
    success: true,
    employees,
    totals: {
      employeeCount: employees.length,
      plannedHours: totalPlannedHours,
      workedHours: totalWorkedHours,
      cost: totalCost,
      missingRateCount,
      hasOpenShift,
    },
  };
}
