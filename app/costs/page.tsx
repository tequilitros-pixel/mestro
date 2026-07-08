import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";

export default async function CostsPage() {
  const lots = await prisma.lot.findMany({
    include: {
      expenses: true,
      distillations: {
        include: {
          events: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const summaries = lots.map((lot) => {
    const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

    const totalLiters = lot.distillations.reduce((sum, d) => {
      const liters = d.events.reduce((s, e) => s + (e.liters ?? 0), 0);
      return sum + liters;
    }, 0);

    const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

    return {
      id: lot.id,
      code: lot.code,
      totalCost,
      totalLiters,
      costPerLiter,
    };
  });

  const totalCostAll = summaries.reduce((sum, lot) => sum + lot.totalCost, 0);
  const totalLitersAll = summaries.reduce((sum, lot) => sum + lot.totalLiters, 0);

  const averageCostPerLiter =
    totalLitersAll > 0 ? totalCostAll / totalLitersAll : 0;

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
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

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold">Lotes</h2>

          <div className="space-y-4">
            {summaries.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}/costs`}
                className="grid gap-3 rounded-2xl bg-slate-800 p-5 transition hover:bg-slate-700 md:grid-cols-4"
              >
                <div>
                  <p className="text-sm text-slate-400">Lote</p>
                  <p className="text-xl font-bold text-amber-400">{lot.code}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Costo total</p>
                  <p className="text-xl font-bold">
                    ${lot.totalCost.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Litros</p>
                  <p className="text-xl font-bold">
                    {lot.totalLiters.toFixed(2)} L
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Costo/L</p>
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
    <div className="rounded-2xl bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}