import "server-only";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, parseDateOnly, formatDateOnly } from "@/lib/dateOnly";

/** Una semana aprobada o pagada ya no admite cambios en sus fuentes. */
export async function isPayrollDateLocked(date: Date | string) {
  const dateKey = typeof date === "string" ? date : formatDateOnly(date);
  const period = await prisma.payrollPeriod.findUnique({
    where: { weekStart: parseDateOnly(mondayOfWeek(dateKey)) },
    select: { status: true },
  });
  return period?.status === "APROBADA" || period?.status === "PAGADA";
}

export const PAYROLL_LOCKED_MESSAGE =
  "Este periodo ya fue aprobado y no acepta modificaciones. Un administrador debe reabrirlo desde Nómina.";
