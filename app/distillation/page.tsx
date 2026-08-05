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
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-7xl">
      

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
              MAESTRO
            </p>

            <h1 className="mt-3 text-5xl font-bold">Destilación</h1>

            <p className="mt-2 text-on-surface-variant">
              Control de alambiques, destrozado, rectificación y cortes.
            </p>
          </div>

          <Link
            href="/distillation/new"
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
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
            <div className="rounded-2xl bg-surface-container p-8 text-on-surface-variant">
              Aún no hay destilaciones registradas.
            </div>
          ) : (
            distillations.map((distillation) => (
              <Link
                key={distillation.id}
                href={`/distillation/${distillation.id}`}
                className="block rounded-2xl bg-surface-container p-6 transition hover:bg-surface-container-high"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm uppercase tracking-[0.25em] text-outline">
                      {distillation.type}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      {distillation.lot.code}
                    </h2>

                    <p className="mt-2 text-on-surface-variant">
                      {distillation.equipment.name} •{" "}
                      {distillation.loadedLiters.toLocaleString()} L cargados
                    </p>

                    <p className="mt-1 text-sm text-outline">
                      Inicio: {distillation.startedAt.toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      distillation.status === "ACTIVA"
                        ? "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim"
                        : "bg-surface-container-highest text-on-surface-variant"
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
    <div className="rounded-2xl bg-surface-container p-6">
      <p className="text-on-surface-variant">{title}</p>
      <p className="mt-4 text-4xl font-bold text-primary">{value}</p>
    </div>
  );
}