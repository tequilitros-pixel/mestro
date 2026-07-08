import { prisma } from "@/lib/prisma";
import Link from "next/link";


export default async function LotsPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
       

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>
            <h1 className="mt-3 text-4xl font-bold">Lotes</h1>
            <p className="mt-2 text-slate-400">
              Expedientes de producción desde recepción hasta producto terminado.
            </p>
          </div>

          <Link
            href="/lots/new"
            className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950"
          >
            Nuevo lote
          </Link>
        </div>

        <div className="grid gap-4">
          {lots.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 p-8 text-slate-400">
              Aún no hay lotes registrados.
            </div>
          ) : (
            lots.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="rounded-2xl bg-slate-900 p-6 transition hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Código de lote</p>
                    <h2 className="mt-1 text-2xl font-bold">{lot.code}</h2>
                  </div>

                  <span className="rounded-full bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-400">
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
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}