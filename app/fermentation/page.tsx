import Link from "next/link";
import { prisma } from "@/lib/prisma";


export default async function FermentationPage() {
  const fermentations = await prisma.fermentation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lot: true,
      readings: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
      

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>
            <h1 className="mt-3 text-4xl font-bold">Fermentación</h1>
          </div>

          <Link
            href="/fermentation/new"
            className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black"
          >
            Nueva fermentación
          </Link>
        </div>

        <section className="mt-8 grid gap-4">
          {fermentations.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 p-8 text-center text-slate-400">
              No hay fermentaciones registradas.
            </div>
          ) : (
            fermentations.map((fermentation) => {
              const last = fermentation.readings[0];

              return (
                <Link
                  key={fermentation.id}
                  href={`/fermentation/${fermentation.id}`}
                  className="rounded-2xl bg-slate-900 p-6 transition hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Lote</p>
                      <h2 className="text-2xl font-bold">
                        {fermentation.lot.code}
                      </h2>
                    </div>

                    <p className="text-xl font-bold text-green-400">
                      {fermentation.status}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-5">
                    <Kpi title="Tina" value={fermentation.tank} />
                    <Kpi title="Mosto" value={`${fermentation.mustLiters} L`} />
                    <Kpi title="°Brix" value={last?.brix ?? fermentation.initialBrix} />
                    <Kpi title="pH" value={last?.ph ?? fermentation.initialPh} />
                    <Kpi
                      title="Temp."
                      value={`${last?.temperature ?? fermentation.initialTemperature}°C`}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}