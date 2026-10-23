import Link from "next/link";
import { DistillationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizeDistillations } from "@/lib/distillation/statistics";

export default async function DistillationStatisticsPage() {
  const lots = await prisma.lot.findMany({
    where: { distillations: { some: { status: DistillationStatus.TERMINADA } } },
    include: {
      distillations: {
        where: { status: DistillationStatus.TERMINADA },
        include: {
          equipment: { select: { name: true } },
          sourceFermentation: { select: { tank: true } },
          sourceDistillation: { include: { sourceFermentation: { select: { tank: true } } } },
        },
        orderBy: { startedAt: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-on-surface sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Producción correlacionada</p><h1 className="mt-2 text-3xl font-bold">Estadísticas por tina y alambique</h1><p className="mt-2 text-on-surface-variant">Volumen, rendimiento y alcohol conservan la fuente real de cada corrida.</p></div>
        <Link href="/distillation" className="rounded-xl border border-outline-variant px-4 py-2 font-bold">Volver a destilación</Link>
      </header>
      <div className="mt-8 space-y-8">
        {lots.map((lot) => {
          const groups = summarizeDistillations(lot.distillations.map((run) => ({
            id: run.id,
            tankName: run.sourceFermentation?.tank ?? run.sourceDistillation?.sourceFermentation?.tank ?? "Sin tina histórica",
            equipmentName: run.equipment.name,
            loadedLiters: run.loadedLiters,
            finalLiters: run.finalLiters,
            finalAlcohol: run.finalAlcohol,
            finalHeadsLiters: run.finalHeadsLiters,
            finalHeartLiters: run.finalHeartLiters,
            finalTailsLiters: run.finalTailsLiters,
          })));
          return (
            <section key={lot.id} className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
              <h2 className="text-2xl font-bold">Lote {lot.code}</h2>
              <div className="mt-5 space-y-5">
                {groups.map((group) => (
                  <article key={group.tankName} className="rounded-xl bg-surface-container-high p-5">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Metric label="Tina" value={group.tankName} />
                      <Metric label="Cargados" value={`${format(group.loadedLiters)} L`} />
                      <Metric label="Obtenidos" value={`${format(group.finalLiters)} L`} />
                      <Metric label="Alcohol prom." value={group.averageAlcohol === null ? "—" : `${format(group.averageAlcohol)}%`} />
                    </div>
                    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-on-surface-variant"><tr><th className="pb-2">Alambique</th><th>Carga</th><th>Salida</th><th>Alcohol</th><th>Corazón</th></tr></thead><tbody>{group.runs.map((run) => <tr key={run.id} className="border-t border-outline-variant"><td className="py-3"><Link href={`/distillation/${run.id}`} className="font-bold text-primary">{run.equipmentName}</Link></td><td>{format(run.loadedLiters)} L</td><td>{format(run.finalLiters ?? 0)} L</td><td>{run.finalAlcohol === null ? "—" : `${format(run.finalAlcohol)}%`}</td><td>{format(run.finalHeartLiters ?? 0)} L</td></tr>)}</tbody></table></div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
        {lots.length === 0 && <p className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">Todavía no hay corridas terminadas.</p>}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
}
function format(value: number) { return value.toLocaleString("es-MX", { maximumFractionDigits: 2 }); }
