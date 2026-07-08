import Link from "next/link";
import { prisma } from "@/lib/prisma";


export default async function DistillationPage() {
  const distillations = await prisma.distillation.findMany({
    include: {
      lot: true,
      equipment: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const activeCount = distillations.filter((d) => d.status === "ACTIVA").length;
  const finishedCount = distillations.filter(
    (d) => d.status === "TERMINADA"
  ).length;

  const totalLoadedLiters = distillations.reduce(
    (sum, d) => sum + d.loadedLiters,
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-7xl">
      

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>

            <h1 className="mt-3 text-5xl font-bold">Destilación</h1>

            <p className="mt-2 text-slate-400">
              Control de alambiques, destrozado, rectificación y cortes.
            </p>
          </div>

          <Link
            href="/distillation/new"
            className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black"
          >
            Nueva destilación
          </Link>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          <Card title="Corridas activas" value={activeCount} />
          <Card title="Corridas terminadas" value={finishedCount} />
          <Card title="Litros cargados" value={`${totalLoadedLiters.toLocaleString()} L`} />
        </section>

        <section className="mt-10 space-y-4">
          {distillations.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 p-8 text-slate-400">
              Aún no hay destilaciones registradas.
            </div>
          ) : (
            distillations.map((distillation) => (
              <Link
                key={distillation.id}
                href={`/distillation/${distillation.id}`}
                className="block rounded-2xl bg-slate-900 p-6 transition hover:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-amber-400">
                      {distillation.type}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      {distillation.lot.code}
                    </h2>

                    <p className="mt-2 text-slate-400">
                      {distillation.equipment.name} •{" "}
                      {distillation.loadedLiters.toLocaleString()} L cargados
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Inicio: {distillation.startedAt.toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      distillation.status === "ACTIVA"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {distillation.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-6">
      <p className="text-slate-400">{title}</p>
      <p className="mt-4 text-4xl font-bold text-amber-400">{value}</p>
    </div>
  );
}