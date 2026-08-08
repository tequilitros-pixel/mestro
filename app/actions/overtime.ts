"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  parseDateOnly,
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
} from "@/lib/dateOnly";

/**
 * Tiempo extra.
 *
 * Flujo: el sistema detecta solo las horas que pasan del umbral
 * semanal configurado (por defecto 48 h, Ley Federal del Trabajo) y
 * crea un registro PENDIENTE. Ese tiempo NO se cuenta como costo de
 * nómina hasta que un administrador lo aprueba.
 *
 * Al aprobar se congelan la tarifa y el importe, para que un cambio
 * posterior de sueldo no altere una nómina ya autorizada.
 */

export type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type PayrollSettingsValues = {
  weeklyHourThreshold: number;
  firstTierHours: number;
  firstTierMultiplier: number;
  secondTierMultiplier: number;
};

const DEFAULT_SETTINGS: PayrollSettingsValues = {
  weeklyHourThreshold: 48,
  firstTierHours: 9,
  firstTierMultiplier: 2,
  secondTierMultiplier: 3,
};

type AdminCheck =
  | { error: string; user?: undefined }
  | { error?: undefined; user: { id: string } };

async function requireAdmin(): Promise<AdminCheck> {
  const user = await getCurrentUser();

  if (!user) return { error: "No autorizado" };
  if (user.role !== "ADMIN") {
    return { error: "Solo un administrador puede gestionar el tiempo extra" };
  }

  return { user };
}

const MIGRATION_PENDING =
  "La función de tiempo extra necesita actualizar la base de datos. Corre `npx prisma db push` y reinicia el servidor.";

/**
 * ¿Ya existen las tablas de tiempo extra? Si el cliente de Prisma no se
 * ha regenerado, la propiedad del modelo ni siquiera existe.
 */
function overtimeReady() {
  const client = prisma as unknown as Record<string, unknown>;
  return Boolean(client.overtimeRecord) && Boolean(client.payrollSettings);
}

export async function getPayrollSettings(): Promise<PayrollSettingsValues> {
  if (!overtimeReady()) return DEFAULT_SETTINGS;

  try {
    const settings = await prisma.payrollSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) return DEFAULT_SETTINGS;

    return {
      weeklyHourThreshold: Number(settings.weeklyHourThreshold),
      firstTierHours: Number(settings.firstTierHours),
      firstTierMultiplier: Number(settings.firstTierMultiplier),
      secondTierMultiplier: Number(settings.secondTierMultiplier),
    };
  } catch (error) {
    console.error("Ajustes de nómina no disponibles:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updatePayrollSettingsAction(
  values: PayrollSettingsValues,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (auth.error !== undefined) return { success: false, error: auth.error };
  if (!overtimeReady()) return { success: false, error: MIGRATION_PENDING };

  const { weeklyHourThreshold, firstTierHours, firstTierMultiplier, secondTierMultiplier } =
    values;

  if (!(weeklyHourThreshold > 0) || weeklyHourThreshold > 168) {
    return { success: false, error: "El umbral semanal debe estar entre 1 y 168 horas." };
  }

  if (!(firstTierHours >= 0)) {
    return { success: false, error: "Las horas del primer tramo no pueden ser negativas." };
  }

  if (!(firstTierMultiplier >= 1) || !(secondTierMultiplier >= 1)) {
    return { success: false, error: "Los multiplicadores deben ser al menos 1." };
  }

  try {
    await prisma.payrollSettings.upsert({
      where: { id: "default" },
      update: {
        weeklyHourThreshold,
        firstTierHours,
        firstTierMultiplier,
        secondTierMultiplier,
      },
      create: {
        id: "default",
        weeklyHourThreshold,
        firstTierHours,
        firstTierMultiplier,
        secondTierMultiplier,
      },
    });

    revalidatePath("/timeclock/payroll");

    return { success: true, message: "Ajustes de nómina guardados." };
  } catch (error) {
    console.error("Error updating payroll settings:", error);
    return { success: false, error: "No fue posible guardar los ajustes." };
  }
}

export type OvertimeRow = {
  id: string | null;
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  weekStart: string;
  workedHours: number;
  overtimeHours: number;
  doubleHours: number;
  tripleHours: number;
  hourlyRate: number | null;
  amount: number | null;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  reviewedByName: string | null;
  reviewedAt: string | null;
};

function splitTiers(overtimeHours: number, settings: PayrollSettingsValues) {
  const doubleHours = Math.min(overtimeHours, settings.firstTierHours);
  const tripleHours = Math.max(overtimeHours - settings.firstTierHours, 0);
  return { doubleHours, tripleHours };
}

function computeAmount(
  doubleHours: number,
  tripleHours: number,
  hourlyRate: number | null,
  settings: PayrollSettingsValues,
) {
  if (hourlyRate === null) return null;

  return (
    doubleHours * hourlyRate * settings.firstTierMultiplier +
    tripleHours * hourlyRate * settings.secondTierMultiplier
  );
}

/**
 * Detecta el tiempo extra de un rango de fechas y lo sincroniza con la
 * base: crea registros PENDIENTE nuevos y actualiza las horas de los
 * que siguen pendientes. Los ya aprobados o rechazados NO se tocan —
 * una decisión tomada no se sobrescribe sola.
 */
export async function syncOvertimeForRange(
  from: string,
  to: string,
): Promise<{ error: string } | { success: true; created: number; updated: number }> {
  const auth = await requireAdmin();
  if (auth.error !== undefined) return { error: auth.error };
  if (!overtimeReady()) return { error: MIGRATION_PENDING };

  const settings = await getPayrollSettings();

  // Se analiza por semanas completas (lunes a domingo) porque el
  // umbral de tiempo extra es semanal.
  const firstMonday = mondayOfWeek(from);
  const lastMonday = mondayOfWeek(to);

  const start = parseDateOnly(firstMonday);
  const end = parseDateOnly(addDaysToDateOnly(lastMonday, 7));

  const entries = await prisma.timeClockEntry.findMany({
    where: {
      clockIn: { gte: start, lt: end },
      clockOut: { not: null },
    },
    select: {
      userId: true,
      branchId: true,
      clockIn: true,
      clockOut: true,
      user: { select: { hourlyRate: true } },
    },
  });

  type Acc = {
    userId: string;
    branchId: string;
    weekStart: string;
    hours: number;
    hourlyRate: number | null;
  };

  const byWeek = new Map<string, Acc>();

  for (const entry of entries) {
    if (!entry.clockOut) continue;

    const hours =
      (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
    if (!(hours > 0)) continue;

    const weekStart = mondayOfWeek(formatDateOnly(entry.clockIn));
    const key = `${entry.userId}-${entry.branchId}-${weekStart}`;

    const current =
      byWeek.get(key) ??
      {
        userId: entry.userId,
        branchId: entry.branchId,
        weekStart,
        hours: 0,
        hourlyRate:
          entry.user.hourlyRate !== null ? Number(entry.user.hourlyRate) : null,
      };

    current.hours += hours;
    byWeek.set(key, current);
  }

  const existing = await prisma.overtimeRecord.findMany({
    where: { weekStart: { gte: start, lt: end } },
    select: { id: true, userId: true, branchId: true, weekStart: true, status: true },
  });

  const existingByKey = new Map(
    existing.map((r) => [
      `${r.userId}-${r.branchId}-${formatDateOnly(r.weekStart)}`,
      r,
    ]),
  );

  let created = 0;
  let updated = 0;

  for (const acc of byWeek.values()) {
    const overtimeHours = acc.hours - settings.weeklyHourThreshold;
    const key = `${acc.userId}-${acc.branchId}-${acc.weekStart}`;
    const record = existingByKey.get(key);

    if (overtimeHours <= 0.01) {
      // Ya no hay tiempo extra esa semana (se corrigió una checada):
      // se limpia solo si seguía pendiente.
      if (record && record.status === "PENDIENTE") {
        await prisma.overtimeRecord.delete({ where: { id: record.id } });
        updated += 1;
      }
      continue;
    }

    const { doubleHours, tripleHours } = splitTiers(overtimeHours, settings);

    if (!record) {
      await prisma.overtimeRecord.create({
        data: {
          userId: acc.userId,
          branchId: acc.branchId,
          weekStart: parseDateOnly(acc.weekStart),
          overtimeHours,
          doubleHours,
          tripleHours,
          hourlyRate: acc.hourlyRate,
          amount: null,
          status: "PENDIENTE",
        },
      });
      created += 1;
      continue;
    }

    if (record.status === "PENDIENTE") {
      await prisma.overtimeRecord.update({
        where: { id: record.id },
        data: {
          overtimeHours,
          doubleHours,
          tripleHours,
          hourlyRate: acc.hourlyRate,
        },
      });
      updated += 1;
    }
  }

  revalidatePath("/timeclock/payroll");

  return { success: true, created, updated };
}

export async function getOvertimeForRange(
  from: string,
  to: string,
): Promise<{ error: string } | { success: true; rows: OvertimeRow[] }> {
  const auth = await requireAdmin();
  if (auth.error !== undefined) return { error: auth.error };
  if (!overtimeReady()) return { error: MIGRATION_PENDING };

  const start = parseDateOnly(mondayOfWeek(from));
  const end = parseDateOnly(addDaysToDateOnly(mondayOfWeek(to), 7));

  const records = await prisma.overtimeRecord.findMany({
    where: { weekStart: { gte: start, lt: end } },
    include: {
      user: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: [{ weekStart: "desc" }, { overtimeHours: "desc" }],
  });

  const settings = await getPayrollSettings();

  const rows: OvertimeRow[] = records.map((record) => {
    const overtimeHours = Number(record.overtimeHours);
    const doubleHours = Number(record.doubleHours);
    const tripleHours = Number(record.tripleHours);
    const hourlyRate =
      record.hourlyRate !== null ? Number(record.hourlyRate) : null;

    return {
      id: record.id,
      userId: record.userId,
      userName: record.user.name,
      branchId: record.branchId,
      branchName: record.branch.name,
      weekStart: formatDateOnly(record.weekStart),
      workedHours: settings.weeklyHourThreshold + overtimeHours,
      overtimeHours,
      doubleHours,
      tripleHours,
      hourlyRate,
      // Si ya se aprobó, se muestra el importe congelado. Si sigue
      // pendiente, se muestra el estimado con la tarifa actual.
      amount:
        record.amount !== null
          ? Number(record.amount)
          : computeAmount(doubleHours, tripleHours, hourlyRate, settings),
      status: record.status,
      reviewedByName: record.reviewedBy?.name ?? null,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
    };
  });

  return { success: true, rows };
}

export async function reviewOvertimeAction(
  recordId: string,
  decision: "APROBADO" | "RECHAZADO",
  notes?: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (auth.error !== undefined) return { success: false, error: auth.error };
  if (!overtimeReady()) return { success: false, error: MIGRATION_PENDING };

  try {
    const record = await prisma.overtimeRecord.findUnique({
      where: { id: recordId },
      include: { user: { select: { hourlyRate: true } } },
    });

    if (!record) {
      return { success: false, error: "El registro ya no existe." };
    }

    const settings = await getPayrollSettings();

    const hourlyRate =
      record.user.hourlyRate !== null ? Number(record.user.hourlyRate) : null;

    if (decision === "APROBADO" && hourlyRate === null) {
      return {
        success: false,
        error:
          "Esta persona no tiene tarifa por hora capturada. Captúrala en Personal antes de aprobar su tiempo extra.",
      };
    }

    const amount =
      decision === "APROBADO"
        ? computeAmount(
            Number(record.doubleHours),
            Number(record.tripleHours),
            hourlyRate,
            settings,
          )
        : null;

    await prisma.overtimeRecord.update({
      where: { id: recordId },
      data: {
        status: decision,
        hourlyRate: decision === "APROBADO" ? hourlyRate : record.hourlyRate,
        amount,
        reviewedById: auth.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes?.trim() || null,
      },
    });

    revalidatePath("/timeclock/payroll");

    return {
      success: true,
      message:
        decision === "APROBADO" ? "Tiempo extra aprobado." : "Tiempo extra rechazado.",
    };
  } catch (error) {
    console.error("Error reviewing overtime:", error);
    return { success: false, error: "No fue posible actualizar el registro." };
  }
}

/** Aprueba de golpe todo el tiempo extra pendiente de un rango. */
export async function approveAllPendingOvertimeAction(
  from: string,
  to: string,
): Promise<{ success: true; approved: number; skipped: number } | { success: false; error: string }> {
  const auth = await requireAdmin();
  if (auth.error !== undefined) return { success: false, error: auth.error };
  if (!overtimeReady()) return { success: false, error: MIGRATION_PENDING };

  const start = parseDateOnly(mondayOfWeek(from));
  const end = parseDateOnly(addDaysToDateOnly(mondayOfWeek(to), 7));

  try {
    const pending = await prisma.overtimeRecord.findMany({
      where: { weekStart: { gte: start, lt: end }, status: "PENDIENTE" },
      include: { user: { select: { hourlyRate: true } } },
    });

    const settings = await getPayrollSettings();

    let approved = 0;
    let skipped = 0;

    for (const record of pending) {
      const hourlyRate =
        record.user.hourlyRate !== null ? Number(record.user.hourlyRate) : null;

      // Sin tarifa no se puede costear: se deja pendiente en vez de
      // aprobar un importe en cero que se vería como "ya pagado".
      if (hourlyRate === null) {
        skipped += 1;
        continue;
      }

      await prisma.overtimeRecord.update({
        where: { id: record.id },
        data: {
          status: "APROBADO",
          hourlyRate,
          amount: computeAmount(
            Number(record.doubleHours),
            Number(record.tripleHours),
            hourlyRate,
            settings,
          ),
          reviewedById: auth.user.id,
          reviewedAt: new Date(),
        },
      });

      approved += 1;
    }

    revalidatePath("/timeclock/payroll");

    return { success: true, approved, skipped };
  } catch (error) {
    console.error("Error approving overtime:", error);
    return { success: false, error: "No fue posible aprobar el tiempo extra." };
  }
}
