import { prisma } from "@/lib/prisma";
import { getRecordingStatus } from "@/lib/brain/getRecordingStatus";
import { computeStockMatrix } from "@/app/administration/inventory/lib/stock";

export type NotificationCheckResult = {
  title: string;
  body: string;
  url: string;
} | null;

export async function checkStockBajo(): Promise<NotificationCheckResult> {
  const products = await prisma.inventoryProduct.findMany({
    where: { isActive: true, trackStock: true, minimumStock: { gt: 0 } },
    select: { id: true, name: true, minimumStock: true },
  });

  if (products.length === 0) return null;

  const matrix = await computeStockMatrix(products.map((p) => p.id));

  const lowStock: { branchName: string; productName: string }[] = [];
  for (const branch of matrix.branches) {
    const productMap = matrix.stockByBranch.get(branch.id);
    if (!productMap) continue;
    for (const product of products) {
      const stock = productMap.get(product.id) ?? 0;
      if (stock < Number(product.minimumStock)) {
        lowStock.push({ branchName: branch.name, productName: product.name });
      }
    }
  }

  if (lowStock.length === 0) return null;

  const body =
    lowStock.length === 1
      ? `${lowStock[0].productName} está por debajo del mínimo en ${lowStock[0].branchName}.`
      : `${lowStock.length} productos están por debajo de su stock mínimo en sucursales.`;

  return {
    title: "📦 Stock bajo",
    body,
    url: "/administration/inventory/sucursales/stock",
  };
}

export async function checkLicorCaducidad(
  daysBeforeExpiration: number,
): Promise<NotificationCheckResult> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysBeforeExpiration);

  const count = await prisma.liquorBottle.count({
    where: {
      status: "DISPONIBLE",
      expirationDate: { lte: threshold },
    },
  });

  if (count === 0) return null;

  return {
    title: "⌛ Licores por caducar",
    body:
      count === 1
        ? "Hay 1 botella disponible que se acerca a su fecha de caducidad."
        : `Hay ${count} botellas disponibles que se acercan a su fecha de caducidad.`,
    url: "/liquors/expiration",
  };
}

export async function checkReconteoPendiente(): Promise<NotificationCheckResult> {
  const count = await prisma.eventRecount.count({
    where: { status: "PENDIENTE" },
  });

  if (count === 0) return null;

  return {
    title: "📋 Reconteos pendientes",
    body:
      count === 1
        ? "Hay 1 reconteo de evento con faltantes sin surtir."
        : `Hay ${count} reconteos de eventos con faltantes sin surtir.`,
    url: "/administration/inventory/eventos/events",
  };
}

export async function checkCorteDiferencia(
  minDifference: number,
  since: Date | null,
): Promise<NotificationCheckResult> {
  const windowStart = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const cuts = await prisma.cashCut.findMany({
    where: {
      status: { in: ["CERRADO", "AUDITADO"] },
      closedAt: { gte: windowStart },
    },
    select: { code: true, difference: true, branch: { select: { name: true } } },
  });

  const withDifference = cuts.filter(
    (cut) => cut.difference !== null && Math.abs(cut.difference) >= minDifference,
  );

  if (withDifference.length === 0) return null;

  const body =
    withDifference.length === 1
      ? `El corte ${withDifference[0].code} (${withDifference[0].branch.name}) cerró con una diferencia de $${withDifference[0].difference!.toFixed(2)}.`
      : `${withDifference.length} cortes de caja cerraron con una diferencia mayor a $${minDifference}.`;

  return {
    title: "💰 Diferencia en corte de caja",
    body,
    url: "/pos/sales",
  };
}

export async function checkProcesoAtrasado(): Promise<NotificationCheckResult> {
  const recordingStatus = await getRecordingStatus();

  const overdue = [
    ...(recordingStatus.cooking ?? []),
    ...(recordingStatus.milling ?? []),
    ...(recordingStatus.fermentation ?? []),
    ...(recordingStatus.distillation ?? []),
  ].filter((record) => record.isOverdue);

  if (overdue.length === 0) return null;

  return {
    title: "⏰ Procesos atrasados",
    body:
      overdue.length === 1
        ? `${overdue[0].label} lleva sin registro más de 1 hora.`
        : `${overdue.length} procesos llevan sin registro más de 1 hora.`,
    url: "/control-room",
  };
}
