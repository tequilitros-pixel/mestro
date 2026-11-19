import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { MetricCard, PageHeader, StatusBadge } from "@/components/ui/CompactUI";
import { receiverTotals } from "@/lib/distillation/receiverMath";

const TYPE_LABELS: Record<string, string> = { DESTROZADO: "Destrozado", RECTIFICACION: "Rectificación" };
const liters = (value: number) => value.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default async function DistillationsByLotPage({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      distillations: {
        include: {
          equipment: { select: { name: true } },
          sourceFermentation: { select: { tank: true } },
          sourceReceiver: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
      },
      fermentations: {
        select: { id: true, tank: true, status: true, mustLiters: true },
        orderBy: { startedAt: "desc" },
      },
      distillationReceivers: {
        include: { transfers: true, rectifications: { select: { loadedLiters: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lot) notFound();

  const finished = lot.distillations.filter((run) => run.status === "TERMINADA");
  const active = lot.distillations.filter((run) => run.status === "ACTIVA");
  const totalOutput = finished.reduce((sum, run) => sum + (run.finalLiters ?? 0), 0);
  const availableToStart = lot.stage !== "TERMINADO";

  return (
    <main className="page-frame text-on-surface">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/distillation" className="text-sm font-semibold text-primary underline">← Volver a lotes de destilación</Link>
        <PageHeader
          title={`Destilaciones · ${lot.code}`}
          description={<>Corridas, tinas y recepción pertenecientes exclusivamente a este lote. <StatusBadge tone={lot.stage === "TERMINADO" ? "success" : "neutral"}>{lot.stage.replaceAll("_", " ")}</StatusBadge></>}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/distillation/receivers?lotId=${lot.id}`} className="compact-action inline-flex items-center border border-outline-variant font-semibold">Tanque receptor</Link>
              {availableToStart && <Link href={`/distillation/new?lotId=${lot.id}`} className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva destilación</Link>}
            </div>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Corridas activas" value={active.length} />
          <MetricCard label="Corridas terminadas" value={finished.length} />
          <MetricCard label="Litros de salida registrados" value={`${liters(totalOutput)} L`} />
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Alambiques y corridas del lote</h2>
          <ProcessTable
            emptyLabel="Todavía no hay corridas en este lote. Puedes iniciar una nueva destilación desde aquí."
            columns={[
              { key: "code", label: "Lote", width: "17%" },
              { key: "type", label: "Proceso", width: "14%" },
              { key: "equipment", label: "Alambique", width: "16%" },
              { key: "source", label: "Origen", width: "16%" },
              { key: "liters", label: "Carga", width: "10%" },
              { key: "startedAt", label: "Inicio", width: "14%" },
              { key: "status", label: "Estado", width: "13%" },
            ]}
            filters={[
              { key: "type", label: "Proceso", options: ["Destrozado", "Rectificación"] },
              { key: "equipment", label: "Alambique", options: [...new Set(lot.distillations.map((run) => run.equipment.name))] },
            ]}
            rows={lot.distillations.map((run) => ({
              id: run.id,
              href: `/distillation/${run.id}`,
              code: lot.code,
              startedAt: run.startedAt.toISOString(),
              status: run.status === "TERMINADA" ? "Terminado" : run.status === "CANCELADA" ? "Cancelado" : "En proceso",
              finished: run.status !== "ACTIVA",
              search: `${lot.code} ${TYPE_LABELS[run.type] ?? run.type} ${run.equipment.name} ${run.sourceFermentation?.tank ?? run.sourceReceiver?.name ?? ""}`,
              values: {
                type: TYPE_LABELS[run.type] ?? run.type,
                equipment: run.equipment.name,
                source: run.sourceFermentation?.tank ?? run.sourceReceiver?.name ?? "Origen histórico",
                liters: `${liters(run.loadedLiters)} L`,
              },
              filters: { type: TYPE_LABELS[run.type] ?? run.type, equipment: run.equipment.name },
            }))}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
            <h2 className="text-base font-bold">Tinas de fermentación de este lote</h2>
            <p className="mt-1 text-xs text-on-surface-variant">Volúmenes históricos; el saldo operativo debe verificarse antes de volver a cargar.</p>
            {lot.fermentations.length === 0 ? (
              <p className="mt-3 text-sm text-on-surface-variant">Sin fermentaciones registradas.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {lot.fermentations.map((tank) => {
                  const allocated = lot.distillations.filter((run) => run.sourceFermentationId === tank.id && run.status !== "CANCELADA").reduce((sum, run) => sum + run.loadedLiters, 0);
                  return <div key={tank.id} className="rounded-xl bg-surface-container-high p-3 text-sm">
                    <div className="flex justify-between gap-2"><span className="font-semibold">{tank.tank}</span><span>{tank.status === "TERMINADA" ? "Fermentación terminada" : "En fermentación"}</span></div>
                    <p className="mt-1 text-on-surface-variant">{liters(tank.mustLiters)} L registrados · {liters(allocated)} L cargados a destrozado</p>
                  </div>;
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Recepción de destrozado del lote</h2>
              <Link href={`/distillation/receivers?lotId=${lot.id}`} className="text-sm font-semibold text-primary underline">Administrar</Link>
            </div>
            {lot.distillationReceivers.length === 0 ? (
              <p className="mt-3 text-sm text-on-surface-variant">Sin tanque receptor registrado para este lote.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {lot.distillationReceivers.map((receiver) => {
                  const stock = receiverTotals(receiver);
                  return <div key={receiver.id} className="rounded-xl bg-surface-container-high p-3 text-sm">
                    <div className="flex justify-between gap-3"><span className="font-semibold">{receiver.name}</span><span>{receiver.status === "OPEN" ? "Recibiendo" : "Listo para rectificación"}</span></div>
                    <p className="mt-1 text-on-surface-variant">{liters(stock.availableLiters)} L disponibles · capacidad {liters(receiver.capacityLiters)} L</p>
                  </div>;
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
