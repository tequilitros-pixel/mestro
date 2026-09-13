"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureWeekStartsAsDraftIfEmpty } from "@/app/actions/schedule";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  weekdayOfDateOnly,
} from "@/lib/dateOnly";

/**
 * ==========================================================
 * Plantillas de SEMANA completa y reutilizable.
 * ----------------------------------------------------------
 * Distinto de BranchScheduleTemplate (que solo es el horario estándar
 * de entrada/salida por sucursal+día, usado para autocompletar horas).
 * Una ScheduleTemplate guarda una "foto" de lunes a domingo — qué
 * empleado trabaja qué día, en qué sucursal, con qué horario y
 * puesto — independiente de la semana real de la que se creó.
 * ==========================================================
 */

/** JS getUTCDay() es domingo=0…sábado=6; las plantillas usan lunes=0…domingo=6. */
function mondayIndexedWeekday(dateStr: string) {
  const jsDay = weekdayOfDateOnly(dateStr);
  return (jsDay + 6) % 7;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Lista de plantillas con conteos, más empleados/sucursales activos para los formularios. */
export async function getScheduleTemplates() {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const [templates, employees, branches] = await Promise.all([
    prisma.scheduleTemplate.findMany({
      include: {
        branch: { select: { id: true, name: true, color: true } },
        shifts: { select: { id: true, userId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    success: true,
    employees,
    branches,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      branch: t.branch,
      shiftCount: t.shifts.length,
      employeeCount: new Set(t.shifts.map((s) => s.userId).filter(Boolean)).size,
      unassignedCount: t.shifts.filter((s) => !s.userId).length,
    })),
  };
}

/** Detalle completo de una plantilla (para editarla o aplicarla). */
export async function getScheduleTemplateDetail(templateId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const template = await prisma.scheduleTemplate.findUnique({
    where: { id: templateId },
    include: {
      branch: { select: { id: true, name: true, color: true } },
      shifts: {
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!template) return { error: "Plantilla no encontrada" };

  return { success: true, template };
}

/** Crea una plantilla vacía, para armarla turno por turno desde cero. */
export async function createTemplateAction(input: {
  name: string;
  description?: string;
  branchId?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const name = input.name?.trim();
  if (!name) return { error: "Ponle un nombre a la plantilla." };

  const template = await prisma.scheduleTemplate.create({
    data: {
      name,
      description: input.description?.trim() || null,
      branchId: input.branchId || null,
      createdById: admin.id,
    },
  });

  revalidatePath("/administration/schedule");
  return { success: true, templateId: template.id };
}

/**
 * Guarda la semana visible en Horario como una plantilla nueva. Es
 * una copia congelada: no queda ninguna relación con esos
 * ScheduledShift, así que editar la semana real después no toca la
 * plantilla. Los turnos de eventos puntuales (con eventId) se
 * excluyen a propósito — un evento nunca se auto-guarda como plantilla.
 */
export async function saveWeekAsTemplateAction(input: {
  weekStart: string;
  name: string;
  description?: string;
  branchId?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const name = input.name?.trim();
  if (!name) return { error: "Ponle un nombre a la plantilla." };

  const mondayStr = mondayOfWeek(input.weekStart);
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));

  const shifts = await prisma.scheduledShift.findMany({
    where: { date: { gte: start, lt: end }, eventId: null },
  });

  if (shifts.length === 0) {
    return { error: "Esa semana no tiene turnos (normales) para guardar como plantilla." };
  }

  const template = await prisma.scheduleTemplate.create({
    data: {
      name,
      description: input.description?.trim() || null,
      branchId: input.branchId || null,
      createdById: admin.id,
      shifts: {
        create: shifts.map((s) => ({
          dayOfWeek: mondayIndexedWeekday(formatDateOnly(s.date)),
          userId: s.userId,
          branchId: s.branchId,
          type: s.type,
          startTime: s.startTime,
          endTime: s.endTime,
          position: s.position,
          notes: s.notes,
        })),
      },
    },
  });

  revalidatePath("/administration/schedule");
  return { success: true, templateId: template.id, count: shifts.length };
}

export async function renameTemplateAction(input: {
  templateId: string;
  name: string;
  description?: string;
  branchId?: string | null;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const name = input.name?.trim();
  if (!name) return { error: "Ponle un nombre a la plantilla." };

  await prisma.scheduleTemplate.update({
    where: { id: input.templateId },
    data: {
      name,
      description: input.description?.trim() || null,
      branchId: input.branchId || null,
    },
  });

  revalidatePath("/administration/schedule");
  return { success: true };
}

export async function duplicateTemplateAction(templateId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const source = await prisma.scheduleTemplate.findUnique({
    where: { id: templateId },
    include: { shifts: true },
  });

  if (!source) return { error: "Plantilla no encontrada" };

  const copy = await prisma.scheduleTemplate.create({
    data: {
      name: `${source.name} (copia)`,
      description: source.description,
      branchId: source.branchId,
      createdById: admin.id,
      shifts: {
        create: source.shifts.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          userId: s.userId,
          branchId: s.branchId,
          type: s.type,
          startTime: s.startTime,
          endTime: s.endTime,
          position: s.position,
          notes: s.notes,
        })),
      },
    },
  });

  revalidatePath("/administration/schedule");
  return { success: true, templateId: copy.id };
}

export async function deleteTemplateAction(templateId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.scheduleTemplate.delete({ where: { id: templateId } });

  revalidatePath("/administration/schedule");
  return { success: true };
}

type UpsertTemplateShiftInput = {
  id?: string;
  templateId: string;
  dayOfWeek: number;
  userId?: string;
  type?: "TURNO" | "DESCANSO";
  branchId?: string;
  startTime?: string;
  endTime?: string;
  position?: string;
  notes?: string;
};

/** Crea o edita (si viene `id`) un turno dentro de una plantilla. */
export async function upsertTemplateShiftAction(input: UpsertTemplateShiftInput) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    return { error: "Día de la semana inválido." };
  }

  const type = input.type ?? "TURNO";

  if (type === "TURNO" && (!input.startTime || !input.endTime)) {
    return { error: "Un turno necesita hora de entrada y salida." };
  }

  const data = {
    templateId: input.templateId,
    dayOfWeek: input.dayOfWeek,
    userId: input.userId || null,
    branchId: type === "TURNO" ? input.branchId || null : null,
    type,
    startTime: type === "TURNO" ? input.startTime! : null,
    endTime: type === "TURNO" ? input.endTime! : null,
    position: input.position?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    await prisma.scheduleTemplateShift.update({ where: { id: input.id }, data });
  } else {
    await prisma.scheduleTemplateShift.create({ data });
  }

  revalidatePath("/administration/schedule");
  return { success: true };
}

export async function deleteTemplateShiftAction(id: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.scheduleTemplateShift.delete({ where: { id } });

  revalidatePath("/administration/schedule");
  return { success: true };
}

/**
 * Aplica una plantilla a una semana destino: crea un ScheduledShift
 * real por cada turno de la plantilla (dayOfWeek → fecha absoluta),
 * sustituyendo empleados según `substitutions` (fromUserId → toUserId)
 * si se indica. Los turnos sin empleado asignado (y sin sustitución)
 * se saltan.
 */
export async function applyTemplateAction(input: {
  templateId: string;
  weekStart: string;
  substitutions?: Record<string, string>;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const template = await prisma.scheduleTemplate.findUnique({
    where: { id: input.templateId },
    include: { shifts: true },
  });

  if (!template) return { error: "Plantilla no encontrada" };
  if (template.shifts.length === 0) return { error: "Esta plantilla no tiene turnos." };

  const mondayStr = mondayOfWeek(input.weekStart);
  const substitutions = input.substitutions ?? {};

  const rows = template.shifts
    .map((s) => {
      const userId = (s.userId && substitutions[s.userId]) || s.userId;
      if (!userId) return null;
      return {
        userId,
        branchId: s.branchId,
        date: parseDateOnly(addDaysToDateOnly(mondayStr, s.dayOfWeek)),
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        position: s.position,
        notes: s.notes,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { error: "Todos los turnos de la plantilla están sin empleado asignado." };
  }

  await prisma.$transaction(async (tx) => {
    await ensureWeekStartsAsDraftIfEmpty(tx, mondayStr);
    await tx.scheduledShift.createMany({ data: rows });
  });

  revalidatePath("/administration/schedule");
  revalidatePath("/timeclock/calendar");

  return { success: true, created: rows.length, skipped: template.shifts.length - rows.length };
}
