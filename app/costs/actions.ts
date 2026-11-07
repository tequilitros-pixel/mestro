"use server";

import { prisma } from "@/lib/prisma";
import { requireModuleActionAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AgaveCostApplicationInput = {
  lotId: string;
  totalAmount: number;
  ranchoName?: string;
  totalKg: number;
  costPerKg: number;
  breakdown: string;
};

/**
 * Registra el costo del agave cosechado como gasto de "Materia prima" en el lote correspondiente.
 */
export async function applyAgaveCostToLotAction(data: AgaveCostApplicationInput) {
  await requireModuleActionAccess("/lots");

  if (
    !data.lotId ||
    !Number.isFinite(data.totalAmount) ||
    !Number.isFinite(data.totalKg) ||
    data.totalAmount <= 0 ||
    data.totalKg <= 0
  ) {
    throw new Error("El gasto y los kilogramos de agave deben ser mayores a cero.");
  }

  const lot = await prisma.lot.findUnique({
    where: { id: data.lotId },
    select: { id: true, code: true },
  });

  if (!lot) {
    throw new Error("Lote no encontrado.");
  }

  const ranchoName = data.ranchoName?.trim();
  const costPerKg = data.totalAmount / data.totalKg;
  const concept = `Agave propio en fábrica${ranchoName ? ` - ${ranchoName}` : ""}`;
  const notes = `Cosecha/Jima propia: ${data.totalKg.toLocaleString("es-MX")} kg de agave a un costo de $${costPerKg.toFixed(2)}/kg.\n${data.breakdown}`;

  const expense = await prisma.lotExpense.create({
    data: {
      lotId: data.lotId,
      category: "Materia prima",
      concept,
      amount: data.totalAmount,
      notes,
    },
  });

  revalidatePath("/costs");
  revalidatePath(`/lots/${data.lotId}`);
  revalidatePath(`/lots/${data.lotId}/costs`);

  return {
    success: true,
    expenseId: expense.id,
    lotCode: lot.code,
  };
}
