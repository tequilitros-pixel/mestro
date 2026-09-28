import "server-only";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, parseDateOnly, formatBusinessDateOnly } from "@/lib/dateOnly";

/** Una semana aprobada o pagada ya no admite cambios en sus fuentes. */
export async function isPayrollDateLocked(date: Date | string, userId?: string) {
  const dateKey = typeof date === "string" ? date : formatBusinessDateOnly(date);
  const period = await prisma.payrollPeriod.findUnique({
    where: { weekStart: parseDateOnly(mondayOfWeek(dateKey)) },
    select: {
      status: true,
      ...(userId ? { entries: { where: { userId }, select: { status: true } } } : {}),
    },
  });
  if (period?.status === "APROBADA" || period?.status === "PAGADA") return true;
  if (userId && period?.status === "REVISION" && "entries" in period) {
    return period.entries.some((entry) => entry.status === "APROBADA" || entry.status === "PAGADA");
  }
  return false;
}

export const PAYROLL_LOCKED_MESSAGE =
  "Esta nómina ya fue aprobada. Reabre el periodo y al empleado desde Nómina para corregirla.";
