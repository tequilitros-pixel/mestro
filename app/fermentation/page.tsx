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
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">
      

        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
              MAESTRO
            </p>
            <h1 className="mt-3 text-4xl font-bold">Fermentación</h1>
          </div>

          <Link
            href="/fermentation/new"
            className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Nueva fermentación
          </Link>
        </div>

        <section className="mt-8 grid gap-4">
          {fermentations.length === 0 ? (
            <div className="rounded-2xl bg-surface-container p-8 text-center text-on-surface-variant">
              No hay fermentaciones registradas.
            </div>
          ) : (
            fermentations.map((fermentation) => {
              const last = fermentation.readings[0];

              return (
                <Link
                  key={fermentation.id}
                  href={`/fermentation/${fermentation.id}`}
                  className="rounded-2xl bg-surface-container p-6 transition hover:bg-surface-container-high"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-on-surface-variant">Lote</p>
                      <h2 className="text-2xl font-bold">
                        {fermentation.lot.code}
                      </h2>
                    </div>

                    <p className="text-xl font-bold text-tertiary-fixed-dim">
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
    <div className="rounded-xl bg-surface-container-high p-4">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}