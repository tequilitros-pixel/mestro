import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MetricCard, PageHeader } from "@/components/ui/CompactUI";
import BottlingList, { type BottlingCard } from "./BottlingList";

export default async function LiquorBottlingPage() {
  const batches = await prisma.liquorBatch.findMany({
    where: {
      status: {
        in: ["LISTO_PARA_EMBOTELLAR", "EMBOTELLANDO", "TERMINADO"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: true,
      recipe: true,
      bottlings: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          code: true,
          status: true,
          bottleSizeMl: true,
          plannedBottles: true,
          producedBottles: true,
          rejectedBottles: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  const cards: BottlingCard[] = batches.map((batch) => {
    const latest = batch.bottlings[0];

    return {
      id: batch.id,
      code: batch.code,
      status: batch.status,
      productName: batch.product.name,
      productIcon: batch.product.icon,
      recipeName: batch.recipe.name,
      actualLiters: batch.actualLiters,
      bottlingsCount: batch.bottlings.length,
      latest: latest
        ? {
            code: latest.code,
            status: latest.status,
            bottleSizeMl: latest.bottleSizeMl,
            plannedBottles: latest.plannedBottles,
            producedBottles: latest.producedBottles,
            rejectedBottles: latest.rejectedBottles,
            startedAt: latest.startedAt?.toISOString() ?? null,
            finishedAt: latest.finishedAt?.toISOString() ?? null,
          }
        : null,
    };
  });

  /*
   * Los lotes terminados son mayoría y, ordenados solo por fecha,
   * empujaban hacia abajo justo los que piden acción. Primero lo
   * que hay que embotellar hoy, luego el histórico.
   */
  const statusPriority: Record<string, number> = {
    EMBOTELLANDO: 0,
    LISTO_PARA_EMBOTELLAR: 1,
    TERMINADO: 2,
  };

  cards.sort(
    (a, b) =>
      (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9)
  );

  const readyCount = cards.filter(
    (card) => card.status === "LISTO_PARA_EMBOTELLAR"
  ).length;

  const inProgressCount = cards.filter(
    (card) => card.status === "EMBOTELLANDO"
  ).length;

  const producedBottles = batches.reduce(
    (total, batch) =>
      total +
      batch.bottlings.reduce(
        (sum, bottling) => sum + bottling.producedBottles,
        0
      ),
    0
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Embotellado" description="Control de producción, mermas y presentaciones." />

      {batches.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">No hay lotes disponibles para embotellar. <Link href="/liquors/production" className="font-semibold underline">Ver producción</Link></p>
      ) : (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Embotellados activos" value={inProgressCount} />
            <MetricCard label="Botellas producidas" value={producedBottles} tone="success" />
            <MetricCard label="Listos para embotellar" value={readyCount} />
            <MetricCard label="Litros utilizados" value={`${batches.reduce((sum, item) => sum + (item.actualLiters ?? 0), 0).toLocaleString("es-MX")} L`} />
          </section>

          <div className="mt-4"><BottlingList batches={cards} /></div>
        </>
      )}
    </main>
  );
}
