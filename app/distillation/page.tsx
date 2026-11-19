import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MetricCard, PageHeader, StatusBadge } from "@/components/ui/CompactUI";

const liter = (value: number) => value.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default async function DistillationPage() {
  // Solo lotes que ya tienen destilaciones, mosto terminado o etapa de destilación.
  // Ninguna fila mezcla corridas de otro lote.
  const lots = await prisma.lot.findMany({
    where: {
      OR: [
        { distillations: { some: {} } },
        { fermentations: { some: { status: "TERMINADA" } } },
        { distillationReceivers: { some: {} } },
        { stage: { in: ["DESTILACION", "RECTIFICACION"] } },
      ],
    },
    select: {
      id: true,
      code: true,
      stage: true,
      startedAt: true,
      distillations: {
        select: { id: true, status: true, loadedLiters: true, finalLiters: true, type: true },
      },
      fermentations: { select: { id: true, status: true } },
      distillationReceivers: { select: { id: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const ordered = [...lots].sort((a, b) => {
    const finishedA = a.stage === "TERMINADO" ? 1 : 0;
    const finishedB = b.stage === "TERMINADO" ? 1 : 0;
    return finishedA - finishedB || b.startedAt.getTime() - a.startedAt.getTime();
  });

  const totalRuns = lots.reduce((sum, lot) => sum + lot.distillations.length, 0);
  const activeRuns = lots.reduce((sum, lot) => sum + lot.distillations.filter((run) => run.status === "ACTIVA").length, 0);
  const activeLots = lots.filter((lot) => lot.stage !== "TERMINADO").length;

  return (
    <main className="page-frame text-on-surface">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="Destilación"
          description="Selecciona primero el lote para consultar sus alambiques, tinas y tanque receptor, o iniciar otra corrida."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/distillation/receivers" className="compact-action inline-flex items-center border border-outline-variant font-semibold">Tanques receptores</Link>
              <Link href="/distillation/statistics" className="compact-action inline-flex items-center border border-outline-variant font-semibold">Estadísticas</Link>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Lotes en proceso" value={activeLots} />
          <MetricCard label="Corridas activas" value={activeRuns} />
          <MetricCard label="Corridas registradas" value={totalRuns} />
        </div>
        <h2 className="text-base font-bold">Lotes de destilación</h2>
        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
            Aún no hay lotes con actividad de destilación.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ordered.map((lot) => {
              const active = lot.distillations.filter((run) => run.status === "ACTIVA").length;
              const completed = lot.distillations.filter((run) => run.status === "TERMINADA");
              const produced = completed.reduce((sum, run) => sum + (run.finalLiters ?? 0), 0);
              return (
                <Link
                  key={lot.id}
                  href={`/distillation/lots/${lot.id}`}
                  className="group rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:border-primary hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-on-surface-variant">Lote de producción</p>
                      <h3 className="mt-1 break-words font-mono text-base font-bold group-hover:text-primary">{lot.code}</h3>
                    </div>
                    <StatusBadge tone={lot.stage === "TERMINADO" ? "success" : active > 0 ? "warning" : "neutral"}>
                      {lot.stage === "TERMINADO" ? "Terminado" : active > 0 ? "En proceso" : "Sin corridas activas"}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-outline-variant pt-3 text-sm">
                    <div><p className="text-xs text-on-surface-variant">Corridas</p><p className="font-bold">{lot.distillations.length} ({active} activas)</p></div>
                    <div><p className="text-xs text-on-surface-variant">Salida registrada</p><p className="font-bold">{liter(produced)} L</p></div>
                    <div><p className="text-xs text-on-surface-variant">Fermentaciones</p><p className="font-semibold">{lot.fermentations.length}</p></div>
                    <div><p className="text-xs text-on-surface-variant">Tanques receptores</p><p className="font-semibold">{lot.distillationReceivers.length}</p></div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-primary">Ver destilaciones de este lote →</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
