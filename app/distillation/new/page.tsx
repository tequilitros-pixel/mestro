import { DistillationType } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModuleActionAccess } from "@/lib/auth";
import { findAvailableEquipment } from "@/lib/equipmentAvailability";
import {
  DistillationOperationError,
  closeEmptyFermentationSource,
  getDistillationSources,
  getFermentationSourceDiscrepancies,
  startDistillationRun,
  verifyFermentationSourceHasMust,
} from "@/lib/distillation/operations";

export default async function NewDistillationPage({
  searchParams,
}: {
  searchParams: Promise<{ lotId?: string; error?: string; verified?: string; reconciled?: string }>;
}) {
  const { lotId, error, verified, reconciled } = await searchParams;
  // No se permite abrir corridas sin seleccionar lote.
  if (!lotId) redirect("/distillation");
  const [lot, sources, equipments, receivers, discrepancies] = await Promise.all([
    prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, code: true, stage: true, fermentations: {
        select: { id: true, tank: true, mustLiters: true, status: true },
        orderBy: { startedAt: "desc" },
      } },
    }),
    getDistillationSources(lotId),
    findAvailableEquipment(["ALAMBIQUE"]),
    prisma.distillationReceiver.findMany({
      where: { status: "OPEN", lotId },
      include: { lot: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getFermentationSourceDiscrepancies(lotId),
  ]);
  if (!lot) notFound();
  if (lot.stage === "TERMINADO") redirect(`/distillation/lots/${lotId}`);
  const newUrl = `/distillation/new?lotId=${encodeURIComponent(lotId)}`;

  const defaultSource = sources.find((s) => s.lotId === queryLotId) ?? sources[0];

  async function createDistillation(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    const [kind, sourceId] = String(formData.get("source") ?? "").split(":");
    const sourceKind = kind as "FERMENTATION" | "DISTILLATION" | "RECEIVER";
    const type = sourceKind === "FERMENTATION" ? DistillationType.DESTROZADO : DistillationType.RECTIFICACION;
    if (!sourceId || !["FERMENTATION", "DISTILLATION", "RECEIVER"].includes(sourceKind)) {
      redirect(`${newUrl}&error=Fuente%20inválida`);
    }
    try {
      const run = await startDistillationRun({
        sourceId,
        expectedLotId: lotId,
        type,
        sourceKind,
        plannedReceiverId: type === DistillationType.DESTROZADO ? String(formData.get("plannedReceiverId") ?? "") || null : null,
        equipmentId: String(formData.get("equipmentId") ?? ""),
        loadedLiters: Number(formData.get("loadedLiters")),
        fillPercent: Number(formData.get("fillPercent")),
        initialAlcohol: formData.get("initialAlcohol") ? Number(formData.get("initialAlcohol")) : null,
      });
      redirect(`/distillation/${run.id}?created=1`);
    } catch (caught) {
      if (caught instanceof DistillationOperationError) {
        redirect(`${newUrl}&error=${encodeURIComponent(caught.message)}`);
      }
      throw caught;
    }
  }

  async function markTinaEmpty(formData: FormData) {
    "use server";
    const actor = await requireModuleActionAccess("/distillation");
    try {
      await closeEmptyFermentationSource({
        fermentationId: String(formData.get("fermentationId") ?? ""),
        expectedLotId: lotId,
        actorId: actor.id,
        reason: String(formData.get("reason") ?? ""),
      });
    } catch (caught) {
      if (caught instanceof DistillationOperationError) {
        redirect(`${newUrl}&error=${encodeURIComponent(caught.message)}`);
      }
      throw caught;
    }
    redirect(`${newUrl}&reconciled=1`);
  }

  async function confirmTinaHasMust(formData: FormData) {
    "use server";
    const actor = await requireModuleActionAccess("/distillation");
    try {
      await verifyFermentationSourceHasMust({
        fermentationId: String(formData.get("fermentationId") ?? ""),
        expectedLotId: lotId,
        actorId: actor.id,
        reason: String(formData.get("reason") ?? ""),
      });
    } catch (caught) {
      if (caught instanceof DistillationOperationError) {
        redirect(`${newUrl}&error=${encodeURIComponent(caught.message)}`);
      }
      throw caught;
    }
    redirect(`${newUrl}&verified=1`);
  }

  const blockers: string[] = [];
  if (sources.length === 0) blockers.push("No hay tinas con mosto verificado ni tanques de recepción listos para rectificar. Revisa los saldos por conciliar o cierra la recepción.");
  if (equipments.length === 0) blockers.push("Todos los alambiques están ocupados o fuera de servicio.");

  return (
    <main className="min-h-screen bg-background p-6 text-on-surface sm:p-10">
      <div className="mx-auto max-w-4xl">
        <Link href={`/distillation/lots/${lotId}`} className="text-sm font-semibold text-primary underline">← Volver a las destilaciones del lote</Link>
        <p className="mt-4 font-mono text-sm uppercase tracking-[0.3em] text-on-surface-variant">MAESTRO · LOTE {lot.code}</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Nueva destilación</h1>
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant">Lote seleccionado</p>
          <p className="mt-1 break-words font-mono text-lg font-bold">{lot.code}</p>
          <p className="mt-1 text-sm text-on-surface-variant">Solo podrás registrar tinas y destrozado pertenecientes a este lote. Para trabajar en otro lote, vuelve a la lista.</p>
        </div>
        <p className="mt-3 text-on-surface-variant">
          Solo aparecen tinas con mosto disponible y tanques receptores listos para rectificar. Las salidas de destrozado se reúnen primero en el tanque receptor.
        </p>
        <p className="mt-3 text-sm"><Link className="font-semibold text-primary underline" href={`/distillation/receivers?lotId=${lotId}`}>Administrar tanque receptor de este lote</Link></p>
        {error && <div className="mt-6 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{error}</div>}
        {(verified || reconciled) && <div role="status" className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
          {verified ? "Mosto confirmado. La tina vuelve a aparecer como fuente disponible." : "Tina conciliada como vacía. El saldo contable pendiente quedó registrado en bitácora."}
        </div>}
        {discrepancies.length > 0 && (
          <section className="mt-6 space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
            <h2 className="text-lg font-bold">Tinas con saldo pendiente de conciliación</h2>
            <p className="text-sm text-on-surface-variant">
              El volumen restante es contable, no significa que siga habiendo mosto en la tina.
              Por seguridad estas fuentes no se ofrecen para una nueva corrida hasta confirmar si hay producto.
              Los registros originales de destrozado se conservan.
            </p>
            {discrepancies.map((source) => (
              <div key={source.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <p className="font-semibold">{source.lotCode} · {source.tank}</p>
                <p className="mt-1 text-sm">Registrados: {source.originalLiters.toLocaleString("es-MX")} L · cargados a destrozado: {source.allocatedLiters.toLocaleString("es-MX")} L · diferencia: <strong>{source.remainingLiters.toLocaleString("es-MX")} L</strong></p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <form action={markTinaEmpty} className="grid gap-2">
                    <input name="fermentationId" type="hidden" value={source.id} />
                    <label className="text-xs font-semibold" htmlFor={`empty-${source.id}`}>Si la tina está físicamente vacía, escribe el motivo</label>
                    <textarea id={`empty-${source.id}`} name="reason" required minLength={12} maxLength={500} placeholder="Ej. Tina vacía, se revisaron las descargas y falta conciliar volumen de proceso" className="min-h-20 rounded-xl border border-outline-variant bg-surface-container-high p-3 text-sm" />
                    <button className="rounded-xl border border-outline-variant px-4 py-3 font-semibold">Confirmar tina vacía y guardar diferencia</button>
                  </form>
                  <form action={confirmTinaHasMust} className="grid gap-2">
                    <input name="fermentationId" type="hidden" value={source.id} />
                    <label className="text-xs font-semibold" htmlFor={`still-${source.id}`}>Si todavía hay mosto, deja constancia de la verificación</label>
                    <textarea id={`still-${source.id}`} name="reason" required minLength={12} maxLength={500} placeholder="Ej. Se midió la tina, aún hay mosto para cargar a destrozado" className="min-h-20 rounded-xl border border-outline-variant bg-surface-container-high p-3 text-sm" />
                    <button className="rounded-xl border border-primary px-4 py-3 font-semibold text-primary">Confirmar que queda mosto</button>
                  </form>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="mt-5 rounded-2xl border border-outline-variant bg-surface-container p-4">
          <h2 className="font-bold">Tinas registradas en este lote</h2>
          {lot.fermentations.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">Este lote aún no tiene tinas de fermentación registradas.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {lot.fermentations.map((tank) => {
                const source = sources.find((item) => item.sourceKind === "FERMENTATION" && item.id === tank.id);
                const pending = discrepancies.find((item) => item.id === tank.id);
                return (
                  <div key={tank.id} className="rounded-xl border border-outline-variant bg-surface-container-high p-3 text-sm">
                    <p className="font-semibold">{tank.tank}</p>
                    <p className="mt-1 text-on-surface-variant">{tank.mustLiters.toLocaleString("es-MX")} L de mosto registrados</p>
                    <p className="mt-1 font-medium">{source
                      ? `${source.availableLiters.toLocaleString("es-MX")} L disponibles para destrozado`
                      : pending
                        ? `${pending.remainingLiters.toLocaleString("es-MX")} L pendientes de conciliación`
                        : tank.status !== "TERMINADA" ? "Fermentación en proceso" : "Sin mosto disponible para carga"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {blockers.length > 0 ? (
          <div className="mt-8 space-y-2 rounded-2xl border border-secondary/30 bg-secondary/10 p-8">
            {blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
          </div>
        ) : (
          <form action={createDistillation} className="mt-8 grid gap-5 rounded-2xl bg-surface-container p-8">
            <label className="grid gap-2 text-sm font-semibold">
              Fuente y volumen restante
              <select name="source" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
                <option value="">Selecciona una tina con mosto o un tanque receptor listo</option>
                {sources.map((source) => (
                  <option key={`${source.sourceKind}:${source.id}`} value={`${source.sourceKind}:${source.id}`}>
                    {source.lotCode} · {source.tankName ?? "Sin tina"} · {source.label} · quedan {source.availableLiters.toLocaleString("es-MX", { maximumFractionDigits: 2 })} L de {source.sourceLiters.toLocaleString("es-MX")} L
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Destino del destrozado al finalizar (opcional, solo para corridas de destrozado)
              <select name="plannedReceiverId" className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
                <option value="">Sin tanque asignado (puedes transferir después)</option>
                {receivers.map((receiver) => (
                  <option key={receiver.id} value={receiver.id}>
                    {receiver.lot.code} · {receiver.name} · máximo {receiver.capacityLiters.toLocaleString("es-MX")} L
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-on-surface-variant">Si eliges un tanque de tu mismo lote, el volumen final se registrará automáticamente al cerrar la corrida.</span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Alambique disponible
              <select name="equipmentId" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
                <option value="">Selecciona un alambique</option>
                {equipments.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>{equipment.name} · capacidad {equipment.capacity.toLocaleString("es-MX")} {equipment.unit}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Porcentaje máximo de carga del alambique
              <input name="fillPercent" type="number" min="1" max="100" step="0.1" defaultValue="80" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Litros a cargar
              <input name="loadedLiters" type="number" min="0.01" step="0.01" placeholder="Litros de esta corrida" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Alcohol inicial % (opcional)
              <input name="initialAlcohol" type="number" min="0" max="100" step="0.01" defaultValue={defaultSource?.initialAlcohol ?? ""} className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
            </label>
            <p className="text-xs text-on-surface-variant">El servidor vuelve a comprobar el saldo y la capacidad al guardar; nunca permite sobreasignar una tina.</p>
            <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary">Abrir corrida</button>
          </form>
        )}
      </div>
    </main>
  );
}
