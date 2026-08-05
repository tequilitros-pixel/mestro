import { prisma } from "@/lib/prisma";
import Link from "next/link";


export default async function LotsPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">


        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
              MAESTRO
            </p>
            <h1 className="mt-3 text-4xl font-bold text-primary">Lotes</h1>
            <p className="mt-2 text-on-surface-variant">
              Expedientes de producción desde recepción hasta producto terminado.
            </p>
          </div>

          <Link
            href="/lots/new"
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Nuevo lote
          </Link>
        </div>

        <div className="grid gap-4">
          {lots.length === 0 ? (
            <div className="rounded-xl bg-surface-container p-8 text-on-surface-variant">
              Aún no hay lotes registrados.
            </div>
          ) : (
            lots.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="rounded-xl bg-surface-container p-6 transition hover:bg-surface-container-high"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-on-surface-variant">Código de lote</p>
                    <h2 className="mt-1 text-2xl font-bold text-primary">{lot.code}</h2>
                  </div>

                  <span className="rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 font-mono text-sm font-bold text-on-surface-variant">
                    {lot.stage}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Kpi title="Agave" value={`${lot.agaveKg.toLocaleString()} kg`} />
                  <Kpi title="ART" value={lot.art ?? "-"} />
                  <Kpi
                    title="Inicio"
                    value={lot.startedAt.toLocaleDateString()}
                  />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-surface-container-high p-4">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-1 text-xl font-bold text-primary">{value}</p>
    </div>
  );
}
