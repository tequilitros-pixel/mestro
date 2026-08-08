import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BottleIcon } from "@/components/ui/icons";
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
      <header>
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Elaboración de licores
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface">
          Embotellado
        </h1>

        <p className="mt-2 max-w-3xl text-on-surface-variant">
          Selecciona un lote listo para iniciar o continuar su proceso de
          embotellado.
        </p>
      </header>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <BottleIcon className="mx-auto h-10 w-10 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay lotes disponibles para embotellar
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">
            Los lotes aparecerán aquí cuando estén listos para embotellado.
          </p>

          <Link
            href="/liquors/production"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Ver producción
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Listos para embotellar" value={readyCount} />
            <SummaryCard label="Embotellando ahora" value={inProgressCount} />
            <SummaryCard
              label="Botellas producidas"
              value={producedBottles}
            />
          </section>

          <BottlingList batches={cards} />
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container p-6">
      <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black text-on-surface">
        {new Intl.NumberFormat("es-MX").format(value)}
      </p>
    </div>
  );
}
