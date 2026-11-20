"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";
import { shouldClosePayrollPeriodOnReceipt } from "@/lib/payroll/receiptSettlement";

/** Firma personal e inmutable del recibo aprobado o pagado. */
export async function savePayrollSignatureAction(input: {
  weekStart: string;
  signatureData: string;
}) {
  const user = await getCurrentUser();
  if (!user?.active) return { error: "No autorizado" };
  const { weekStart, signatureData } = input;
  if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return { error: "Semana de nómina inválida" };
  }
  if (typeof signatureData !== "string" || signatureData.length > 400_000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signatureData)) {
    return { error: "La firma debe ser una imagen PNG válida" };
  }
  const image = Buffer.from(signatureData.slice("data:image/png;base64,".length), "base64");
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 100 || !image.subarray(0, 8).equals(pngHeader)) {
    return { error: "El trazo de firma no es válido" };
  }
  let monday: Date;
  try {
    monday = parseDateOnly(mondayOfWeek(weekStart));
  } catch {
    return { error: "Semana de nómina inválida" };
  }
  // Serializar firmas y cierre de periodo bajo el mismo bloqueo, incluso
  // si dos empleados confirman su recibo al mismo tiempo.
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status"::text AS "status"
      FROM "PayrollPeriod"
      WHERE "weekStart" = ${monday}
      FOR UPDATE
    `;
    const period = locked[0];
    if (!period || period.status === "BORRADOR") {
      return { error: "El periodo no está disponible para firma" };
    }

    const entry = await tx.payrollEntry.findUnique({
      where: { periodId_userId: { periodId: period.id, userId: user.id } },
      select: { id: true, status: true, signedAt: true },
    });
    if (!entry) return { error: "No tienes un recibo de nómina en esta semana" };
    if (entry.signedAt) return { error: "Este recibo ya está firmado y su firma se conserva" };
    if (entry.status !== "APROBADA" && entry.status !== "PAGADA") {
      return { error: "La nómina individual debe estar autorizada antes de firmar de recibido" };
    }

    const now = new Date();
    const updated = await tx.payrollEntry.updateMany({
      where: {
        id: entry.id,
        userId: user.id,
        status: { in: ["APROBADA", "PAGADA"] },
        signedAt: null,
      },
      data: { signatureData, signedAt: now, signedByName: user.name, status: "PAGADA" },
    });
    if (updated.count !== 1) {
      return { error: "El recibo cambió o ya fue firmado. Actualiza la página." };
    }

    // La semana sólo está PAGADA cuando cada expediente está PAGADO.
    // En particular, no cerrar una semana con compañeros sin firmar.
    const pendingCount = await tx.payrollEntry.count({
      where: { periodId: period.id, status: { not: "PAGADA" } },
    });
    const totalCount = await tx.payrollEntry.count({ where: { periodId: period.id } });
    if (shouldClosePayrollPeriodOnReceipt(period.status, totalCount, pendingCount)) {
      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { status: "PAGADA", paidAt: now },
      });
    }

    return { success: true, signedAt: now.toISOString(), signedByName: user.name };
  });

  revalidatePath("/timeclock/payroll");
  revalidatePath("/timeclock/hours");
  return result;
}
