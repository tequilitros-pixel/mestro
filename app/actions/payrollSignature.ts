"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";

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
  // La firma se guarda bajo bloqueo para conservar su carácter inmutable.
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
      data: { signatureData, signedAt: now, signedByName: user.name },
    });
    if (updated.count !== 1) {
      return { error: "El recibo cambió o ya fue firmado. Actualiza la página." };
    }

    return { success: true, signedAt: now.toISOString(), signedByName: user.name };
  });

  revalidatePath("/timeclock/payroll");
  revalidatePath("/timeclock/hours");
  return result;
}
