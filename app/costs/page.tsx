import Link from "next/link";
import { prisma } from "@/lib/prisma";


export default async function CostsPage() {
  const lots = await prisma.lot.findMany({
    include: {
      expenses: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const summaries = lots.map((lot) => {
    const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

    // Solo el lote terminado tiene un total de litros confiable
    // (fijado una sola vez en "Finalizar lote"). Sumar el campo
    // `liters` de cada DistillationEvent cuenta de más: ese campo
    // se usa para lecturas intermedias (cortes, corazón, colas),
    // no solo para el volumen final.
    const totalLiters = lot.totalLitersObtained ?? 0;

    const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

    return {
      id: lot.id,
      code: lot.code,
      totalCost,
      totalLiters,
      costPerLiter,
      isFinished: lot.totalLitersObtained !== null,
    };
  });

  const totalCostAll = summaries.reduce((sum, lot) => sum + lot.totalCost, 0);
  const totalLitersAll = summaries.reduce((sum, lot) => sum + lot.totalLiters, 0);

  const averageCostPerLiter =
    totalLitersAll > 0 ? totalCostAll / totalLitersAll : 0;

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-7xl">
      

        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-5xl font-bold">Centro de Costos</h1>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Card title="Costo total" value={`$${totalCostAll.toLocaleString()}`} />
          <Card title="Litros producidos" value={`${totalLitersAll.toFixed(2)} L`} />
          <Card
            title="Costo promedio/L"
            value={
              averageCostPerLiter > 0
                ? `$${averageCostPerLiter.toFixed(2)}`
                : "-"
            }
          />
        </section>

        <section className="mt-8 rounded-2xl bg-surface-container p-8">
          <h2 className="mb-6 text-2xl font-bold">Lotes</h2>

          <div className="space-y-4">
            {summaries.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}/costs`}
                className="grid gap-3 rounded-2xl bg-surface-container-high p-5 transition hover:bg-surface-container-highest md:grid-cols-4"
              >
                <div>
                  <p className="text-sm text-on-surface-variant">Lote</p>
                  <p className="text-xl font-bold text-primary">{lot.code}</p>
                </div>

                <div>
                  <p className="text-sm text-on-surface-variant">Costo total</p>
                  <p className="text-xl font-bold">
                    ${lot.totalCost.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-on-surface-variant">Litros</p>
                  <p className="text-xl font-bold">
                    {lot.isFinished
                      ? `${lot.totalLiters.toFixed(2)} L`
                      : "Pendiente"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-on-surface-variant">Costo/L</p>
                  <p className="text-xl font-bold">
                    {lot.costPerLiter > 0
                      ? `$${lot.costPerLiter.toFixed(2)}`
                      : "-"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container p-6">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}