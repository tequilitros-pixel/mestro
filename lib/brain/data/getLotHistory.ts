import { prisma } from "@/lib/prisma";

export type HistoricLot = {
  lotId: string;
  code: string;
  agaveKg: number;
  extraction: number | null;
  alcohol: number | null;
  cookingHours: number | null;
  cookingTemp: number | null;
  litersProduced: number | null;
  costPerLiter: number | null;
  createdAt: Date;
};

export async function getLotHistory(): Promise<HistoricLot[]> {
  const lots = await prisma.lot.findMany({
    where: { stage: "TERMINADO" },
    orderBy: { startedAt: "asc" },
    include: {
      cookings: {
        include: { events: true },
      },
      millings: true,
      distillations: {
        include: { events: true },
      },
      expenses: true,
    },
  });

  return lots.map((lot) => {
    // --- Cocción: horas y temperatura promedio ---
    const cooking = lot.cookings[0];
    let cookingHours: number | null = null;
    let cookingTemp: number | null = null;

    if (cooking) {
      if (cooking.finishedAt) {
        cookingHours =
          (cooking.finishedAt.getTime() - cooking.startedAt.getTime()) /
          (1000 * 60 * 60);
      }

      const temps = cooking.events
        .map((e) => e.temperature)
        .filter((t): t is number => t != null);

      if (temps.length > 0) {
        cookingTemp = temps.reduce((s, t) => s + t, 0) / temps.length;
      }
    }

    // --- Molienda: extracción (mosto / kg cocido) ---
    const milling = lot.millings[0];
    let extraction: number | null = null;

    if (milling?.mashLiters != null && milling.cookedKg > 0) {
      extraction = (milling.mashLiters / milling.cookedKg) * 100;
    }

    // --- Destilación: alcohol y litros producidos ---
    const distillation = lot.distillations.find(
      (d) => d.type === "RECTIFICACION"
    ) ?? lot.distillations[0];

    const alcohol = distillation?.finalAlcohol ?? null;
    const litersProduced = distillation?.heartLiters ?? null;

    // --- Costos ---
    const totalCost = lot.expenses.reduce((s, e) => s + e.amount, 0);
    const costPerLiter =
      totalCost > 0 && litersProduced && litersProduced > 0
        ? totalCost / litersProduced
        : null;

    return {
      lotId: lot.id,
      code: lot.code,
      agaveKg: lot.agaveKg,
      extraction,
      alcohol,
      cookingHours,
      cookingTemp,
      litersProduced,
      costPerLiter,
      createdAt: lot.startedAt,
    };
  });
}
