"use server";

import { getCurrentUser } from "@/lib/auth";
import { formatDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";

/**
 * Snapshot que un trabajador puede consultar de su propia nómina. Los
 * importes y horas provienen de PayrollEntry, no del checador en vivo:
 * de este modo una corrección posterior no modifica lo que ya aprobó
 * administración.
 */
export type ApprovedPayrollHistoryItem = {
  weekStart: string;
  weekEnd: string;
  status: "APROBADA" | "PAGADA";
  approvedAt: string | null;
  paidAt: string | null;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  totalPay: number;
};

/**
 * Historial privado del propio trabajador. Nunca recibe un userId como
 * parámetro para evitar que una persona pueda consultar otra nómina.
 */
export async function getMyApprovedPayrollHistory(): Promise<
  { success: true; data: ApprovedPayrollHistoryItem[] } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };

  const entries = await prisma.payrollEntry.findMany({
    where: {
      userId: user.id,
      period: { status: { in: ["APROBADA", "PAGADA"] } },
    },
    select: {
      regularHours: true,
      overtimeHours: true,
      totalHours: true,
      totalPay: true,
      period: {
        select: {
          weekStart: true,
          weekEnd: true,
          status: true,
          approvedAt: true,
          paidAt: true,
        },
      },
    },
    orderBy: { period: { weekStart: "desc" } },
  });

  return {
    success: true,
    data: entries.map((entry) => ({
      weekStart: formatDateOnly(entry.period.weekStart),
      weekEnd: formatDateOnly(entry.period.weekEnd),
      status: entry.period.status as "APROBADA" | "PAGADA",
      approvedAt: entry.period.approvedAt?.toISOString() ?? null,
      paidAt: entry.period.paidAt?.toISOString() ?? null,
      regularHours: Number(entry.regularHours),
      overtimeHours: Number(entry.overtimeHours),
      totalHours: Number(entry.totalHours),
      totalPay: Number(entry.totalPay),
    })),
  };
}
