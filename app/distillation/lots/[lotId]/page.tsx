import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { MetricCard, PageHeader, StatusBadge } from "@/components/ui/CompactUI";
import { receiverTotals } from "@/lib/distillation/receiverMath";
import { totalRunLoadedLiters } from "@/lib/distillation/loadLedger";

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
          supplementalLoads: { include: { fermentation: { select: { tank: true } } } },
          sourceReceiver: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
      },
      fermentations: {
        select: {
          id: true, tank: true, status: true, mustLiters: true, initialBrix: true, finalBrix: true,
          readings: { orderBy: { createdAt: "desc" }, take: 1, select: { brix: true } },
          supplementalLoads: {
            where: { distillation: { status: { not: "CANCELADA" } } },
            select: { liters: true },
          },
        },
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
          <h2 className="text-lg font-bold">Rendimiento agrupado por tina</h2>
          <p className="text-sm text-on-surface-variant">Las cargas se atribuyen por tina, incluida cualquier carga adicional. La salida de una corrida con varias tinas no se atribuye a una sola tina; se informa a nivel de corrida y lote.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {lot.fermentations.map((tank) => {
              const runs = lot.distillations.filter((run) => run.type === "DESTROZADO" && run.sourceFermentationId === tank.id && run.status !== "CANCELADA");
              const charged = runs.reduce((sum, run) => sum + run.loadedLiters, 0)
                + tank.supplementalLoads.reduce((sum, load) => sum + load.liters, 0);
              const blended = tank.supplementalLoads.length > 0 || runs.some((run) => run.supplementalLoads.length > 0);
              const completed = runs.filter((run) => run.status === "TERMINADA" && run.supplementalLoads.length === 0);
              const measurable = completed.length > 0 && completed.every((run) => run.finalLiters != null);
              const output = completed.reduce((sum, run) => sum + (run.finalLiters ?? 0), 0);
              const currentBrix = tank.readings[0]?.brix ?? tank.finalBrix;
              return <div key={tank.id} className="rounded-2xl border border-outline-variant bg-surface-container p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link className="font-semibold text-primary underline" href={"/fermentation/" + tank.id}>{tank.tank}</Link>
                  <span className="text-xs text-on-surface-variant">{tank.status === "TERMINADA" ? "Cerrada" : "Activa"}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-on-surface-variant">Mosto de tina</p><p className="font-bold">{liters(tank.mustLiters)} L</p></div>
                  <div><p className="text-xs text-on-surface-variant">Brix inicio → último</p><p className="font-bold">{liters(tank.initialBrix)}° → {currentBrix == null ? "—" : liters(currentBrix) + "°"}</p></div>
                  <div><p className="text-xs text-on-surface-variant">Carga a destrozado</p><p className="font-bold">{liters(charged)} L · {runs.length} corridas</p></div>
                  <div><p className="text-xs text-on-surface-variant">Destrozado final</p><p className="font-bold">{measurable ? liters(output) + " L" : blended ? "Mezcla: no atribuible" : "Por registrar"}</p></div>
                  <div><p className="text-xs text-on-surface-variant">Destrozado por 1,000 L cargados</p><p className="font-bold">{measurable && charged > 0 ? liters(output * 1000 / charged) + " L" : "—"}</p></div>
                  <div><p className="text-xs text-on-surface-variant">Salida / mosto original</p><p className="font-bold">{measurable && tank.mustLiters > 0 ? liters(100 * output / tank.mustLiters) + "%" : "—"}</p></div>
                </div>
                <p className="mt-3 text-xs text-on-surface-variant">Los porcentajes son volumétricos y no representan alcohol absoluto. Las corridas incompletas no se imputan como salida.</p>
              </div>;
            })}
            {lot.fermentations.length === 0 && <p className="text-sm text-on-surface-variant">No hay tinas de este lote.</p>}
          </div>
        </section>

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
              search: `${lot.code} ${TYPE_LABELS[run.type] ?? run.type} ${run.equipment.name} ${run.sourceFermentation?.tank ?? run.sourceReceiver?.name ?? ""} ${run.supplementalLoads.map((load) => load.fermentation.tank).join(" ")}`,
              values: {
                type: TYPE_LABELS[run.type] ?? run.type,
                equipment: run.equipment.name,
                source: [...new Set([
                  run.sourceFermentation?.tank ?? run.sourceReceiver?.name ?? "Origen histórico",
                  ...run.supplementalLoads.map((load) => load.fermentation.tank),
                ])].join(" + "),
                liters: `${liters(totalRunLoadedLiters(run))} L`,
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
                  const allocated = lot.distillations.filter((run) => run.sourceFermentationId === tank.id && run.status !== "CANCELADA").reduce((sum, run) => sum + run.loadedLiters, 0)
                    + tank.supplementalLoads.reduce((sum, load) => sum + load.liters, 0);
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
