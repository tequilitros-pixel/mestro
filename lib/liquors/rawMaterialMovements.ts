import "server-only";

import { Prisma, RawMaterialMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OUTGOING: RawMaterialMovementType[] = [
  RawMaterialMovementType.CONSUMO_RECETA,
  RawMaterialMovementType.MERMA,
  RawMaterialMovementType.TRASPASO_SUCURSAL,
];

/** Internal primitive; public Server Actions must authorize before calling it. */
export async function applyRawMaterialMovement(
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    rawMaterialId: string;
    type: RawMaterialMovementType;
    amount: number;
    unitCost?: number | null;
    lotId?: string | null;
    liquorBatchId?: string | null;
    branchId?: string | null;
    notes?: string | null;
    createdById?: string | null;
    negative?: boolean;
  },
): Promise<void> {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error("La cantidad de materia prima debe ser un número distinto de cero.");
  }
  if (client === prisma) {
    return prisma.$transaction((tx) => applyRawMaterialMovement(tx, input));
  }
  const magnitude = Math.abs(input.amount);
  const isOutgoing =
    OUTGOING.includes(input.type) ||
    (input.type === RawMaterialMovementType.AJUSTE && input.negative === true);
  const signed = isOutgoing ? -magnitude : magnitude;

  const materials = await client.$queryRaw<Array<{ currentStock: number; averageCost: number | null }>>`
    SELECT "currentStock", "averageCost" FROM "RawMaterial"
    WHERE "id" = ${input.rawMaterialId} FOR UPDATE
  `;
  const material = materials[0];
  if (!material) throw new Error("La materia prima ya no existe.");
  if (isOutgoing && magnitude > material.currentStock) {
    throw new Error(`Existencia insuficiente de materia prima: disponible ${material.currentStock}, requerida ${magnitude}. Registra la entrada real antes de continuar.`);
  }

  let averageCost = material.averageCost;
  if (!isOutgoing && input.unitCost != null && input.unitCost >= 0) {
    const previousStock = Math.max(material.currentStock, 0);
    const previousValue = previousStock * (material.averageCost ?? input.unitCost);
    const incomingValue = magnitude * input.unitCost;
    const totalStock = previousStock + magnitude;
    averageCost =
      totalStock > 0 ? (previousValue + incomingValue) / totalStock : input.unitCost;
  }

  await client.rawMaterialMovement.create({
    data: {
      rawMaterialId: input.rawMaterialId,
      type: input.type,
      quantity: signed,
      unitCost: input.unitCost ?? null,
      lotId: input.lotId ?? null,
      liquorBatchId: input.liquorBatchId ?? null,
      branchId: input.branchId ?? null,
      notes: input.notes ?? null,
      createdById: input.createdById ?? null,
    },
  });

  await client.rawMaterial.update({
    where: { id: input.rawMaterialId },
    data: {
      currentStock: { increment: signed },
      ...(averageCost !== material.averageCost ? { averageCost } : {}),
    },
  });
}
