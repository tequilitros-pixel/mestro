"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";

export async function savePayrollSignatureAction(input: {
  weekStart: string;
  signatureData: string;
}) {
  const user = await getCurrentUser();
  if (!user || !user.active) {
    return { error: "No autorizado" };
  }

  const { weekStart, signatureData } = input;
  if (!weekStart || !signatureData) {
    return { error: "Datos de firma incompletos" };
  }

  // Validar formato de data URL (PNG o JPEG)
  if (!signatureData.startsWith("data:image/") || signatureData.length < 50) {
    return { error: "Trazo de firma inválido" };
  }

  const mondayStr = mondayOfWeek(weekStart);
  const weekStartDate = parseDateOnly(mondayStr);

  const period = await prisma.payrollPeriod.findUnique({
    where: { weekStart: weekStartDate },
    include: {
      entries: {
        where: { userId: user.id },
      },
    },
  });

  if (!period) {
    return { error: "Periodo de nómina no encontrado" };
  }

  const entry = period.entries[0];
  if (!entry) {
    return { error: "No tienes un registro de nómina en este periodo" };
  }

  // Solo se puede firmar si ya está aprobada o pagada
  const isEligible =
    entry.status === "APROBADA" ||
    entry.status === "PAGADA" ||
    period.status === "APROBADA" ||
    period.status === "PAGADA";

  if (!isEligible) {
    return { error: "La nómina debe estar aprobada para poder firmar de conformidad" };
  }

  const now = new Date();

  await prisma.payrollEntry.update({
    where: { id: entry.id },
    data: {
      signatureData,
      signedAt: now,
      signedByName: user.name,
    },
  });

  revalidatePath("/timeclock/payroll");
  revalidatePath("/timeclock/hours");

  return {
    success: true,
    signedAt: now.toISOString(),
    signedByName: user.name,
  };
}
