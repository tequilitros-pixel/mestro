import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function LotsPage() {
  const lots = await prisma.lot.findMany({
    orderBy: {
      createdAt: "desc",
    },
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          {lots.length === 0 ? (
            <div className="p-8 text-slate-400">
              Aún no hay lotes registrados.
            </div>
          ) : (
            lots.map((lot) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="block border-b border-slate-800 p-6 hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{lot.code}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {lot.agaveKg.toLocaleString()} kg de agave
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-400/10 px-4 py-2 text-sm text-amber-400">
                    {lot.stage}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}