import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModuleActionAccess } from "@/lib/auth";
import { findAvailableEquipment } from "@/lib/equipmentAvailability";
import {
  destrozadoProducedLiters,
  receiveExistingDestrozado,
  receiveAllCompletedDestrozados,
  receiverTotals,
  registerReceiver,
  reuseEmptyReceiver,
  sealReceiver,
  startPairRectification,
} from "@/lib/distillation/receivers";
import { DistillationOperationError } from "@/lib/distillation/operations";

function detailError(error: unknown): string {
  return error instanceof DistillationOperationError ? error.message : "No se pudo completar la operación.";
}

function displayLiters(value: number) {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

export default async function DestrozadoReceiversPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireModuleActionAccess("/distillation");
  const { error, saved } = await searchParams;
  const [receivers, lots, availableDestrozados, availableAlambiques] = await Promise.all([
    prisma.distillationReceiver.findMany({
      include: {
        lot: { select: { code: true } },
        transfers: {
          include: { distillation: { include: { equipment: { select: { name: true } } } } },
          orderBy: { createdAt: "asc" },
        },
        rectifications: { include: { equipment: { select: { name: true } } }, orderBy: { startedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lot.findMany({
      where: { stage: { in: ["DESTILACION", "RECTIFICACION"] } },
      select: { id: true, code: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.distillation.findMany({
      where: {
        type: "DESTROZADO",
        status: "TERMINADA",
        receiverTransfer: { is: null },
        derivedDistillations: { none: { status: { not: "CANCELADA" } } },
      },
      include: {
        equipment: { select: { name: true } },
        lot: { select: { code: true } },
      },
      orderBy: { finishedAt: "desc" },
    }),
    findAvailableEquipment(["ALAMBIQUE"]),
  ]);
  const currentReceivers = receivers.filter((receiver, index) =>
    receivers.findIndex((item) => item.name.trim().toLowerCase() === receiver.name.trim().toLowerCase()) === index
  );
  const historicalReceivers = receivers.filter((receiver) => !currentReceivers.some((item) => item.id === receiver.id));

  async function createTank(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await registerReceiver({
        lotId: String(formData.get("lotId") ?? ""),
        name: String(formData.get("name") ?? ""),
        capacityLiters: Number(formData.get("capacityLiters")),
      });
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=tank");
  }

  async function receive(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await receiveExistingDestrozado({
        receiverId: String(formData.get("receiverId") ?? ""),
        distillationId: String(formData.get("distillationId") ?? ""),
      });
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=transfer");
  }

  async function receiveAll(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await receiveAllCompletedDestrozados(String(formData.get("receiverId") ?? ""));
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=all");
  }

  async function makeReady(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await sealReceiver(String(formData.get("receiverId") ?? ""));
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=ready");
  }

  async function reopen(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await reuseEmptyReceiver(String(formData.get("receiverId") ?? ""));
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=reopened");
  }

  async function loadPair(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    try {
      await startPairRectification({
        receiverId: String(formData.get("receiverId") ?? ""),
        first: {
          equipmentId: String(formData.get("firstEquipmentId") ?? ""),
          liters: Number(formData.get("firstLiters")),
        },
        second: {
          equipmentId: String(formData.get("secondEquipmentId") ?? ""),
          liters: Number(formData.get("secondLiters")),
        },
        fillPercent: Number(formData.get("fillPercent") ?? 80),
      });
    } catch (caught) {
      redirect(`/distillation/receivers?error=${encodeURIComponent(detailError(caught))}`);
    }
    redirect("/distillation/receivers?saved=pair");
  }

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href="/distillation" className="text-sm text-primary underline">Volver a destilación</Link>
          <h1 className="mt-3 text-3xl font-bold">Tanques de recepción de destrozado</h1>
          <p className="mt-2 text-on-surface-variant">
            Reúne las descargas terminadas del mismo lote y, cuando termines de recibirlas,
            marca el tanque como listo para rectificar. Puedes cargar dos alambiques al mismo tiempo; cuando el saldo llega a cero el tanque físico queda libre para otro uso.
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Los destrozados ya terminados pueden incorporarse aquí; no es necesario volver a registrarlos.
          </p>
        </header>
        {error && <div role="alert" className="rounded-xl border border-error/40 bg-error/10 p-4 text-error">{error}</div>}
        {saved && <div role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-4">Movimiento guardado correctamente.</div>}

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-xl font-bold">Registrar tanque receptor físico</h2>
          <p className="text-xs text-on-surface-variant">Si ya tienes un tanque de 2,000 L, regístralo una sola vez por recepción. Podrás reutilizarlo al vaciarlo.</p>
          <form action={createTank} className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-sm font-semibold">
              Lote
              <select name="lotId" required className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                <option value="">Selecciona un lote</option>
                {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.code}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
              Nombre físico del tanque
              <input name="name" required maxLength={80} defaultValue="Tanque receptor 1" placeholder="Ej. Tanque receptor 1" className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Capacidad en litros
              <input name="capacityLiters" type="number" min="1" step="0.01" defaultValue={2000} required className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
            </label>
            <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary sm:col-span-4">Crear tanque</button>
          </form>
        </section>

        {currentReceivers.length === 0 && (
          <p className="rounded-2xl border border-outline-variant p-6">Aún no hay tanques receptores registrados.</p>
        )}
        {currentReceivers.map((receiver) => {
          const totals = receiverTotals(receiver);
          const empty = receiver.status === "READY" && totals.availableLiters < 0.005 && totals.receivedLiters > 0;
          const eligible = availableDestrozados.filter((run) =>
            run.lotId === receiver.lotId && destrozadoProducedLiters(run) > 0
          );
          return (
            <section key={receiver.id} className="rounded-2xl border border-outline-variant bg-surface-container p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{receiver.name}</h2>
                  <p className="text-sm text-on-surface-variant">Lote {receiver.lot.code} · {receiver.status === "OPEN" ? "Recibiendo destrozado" : empty ? "Vacío · tanque disponible" : "Listo para rectificar"}</p>
                </div>
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-semibold">
                  {displayLiters(totals.availableLiters)} / {displayLiters(receiver.capacityLiters)} L en receptor
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><p className="text-on-surface-variant">Recibidos</p><p className="font-bold">{displayLiters(totals.receivedLiters)} L</p></div>
                <div><p className="text-on-surface-variant">Cargados a rectificación</p><p className="font-bold">{displayLiters(totals.allocatedLiters)} L</p></div>
                <div><p className="text-on-surface-variant">Capacidad</p><p className="font-bold">{displayLiters(receiver.capacityLiters)} L</p></div>
                <div><p className="text-on-surface-variant">Alcohol promedio*</p><p className="font-bold">{totals.initialAlcohol === null ? "Sin medición" : `${totals.initialAlcohol.toFixed(2)} %`}</p></div>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                *Promedio volumétrico de grados corregidos registrados en las descargas; verifica la mezcla con una medición real antes de rectificar.
              </p>
              {receiver.transfers.length > 0 && (
                <div className="mt-4 rounded-xl border border-outline-variant p-3">
                  <h3 className="font-semibold">Descargas recibidas ({receiver.transfers.length})</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    {receiver.transfers.map((transfer) => (
                      <div key={transfer.id} className="flex justify-between gap-3">
                        <Link href={`/distillation/${transfer.distillationId}`} className="text-primary underline">{transfer.distillation.equipment.name} · {transfer.distillationId.slice(-6)}</Link>
                        <span>{displayLiters(transfer.liters)} L · {transfer.alcohol?.toFixed(2) ?? "—"} %</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {receiver.status === "OPEN" ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-on-surface-variant">La recepción permanece abierta hasta que confirmes que terminaron todas las descargas. Si faltan corridas por registrar, no cierres el tanque todavía.</p>
                  {eligible.length > 0 && (
                    <form action={receiveAll} className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <input type="hidden" name="receiverId" value={receiver.id} />
                      <p className="mb-2 text-sm">Hay {eligible.length} corridas de destrozado terminadas aún sin recibir. Solo se registrarán sus litros finales guardados en Maestro.</p>
                      <button className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary">Recibir juntas las {eligible.length} corridas terminadas</button>
                    </form>
                  )}
                  {eligible.length > 0 && (
                    <form action={receive} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="receiverId" value={receiver.id} />
                      <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-semibold">
                        Incorporar destrozado ya terminado
                        <select name="distillationId" required className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                          <option value="">Selecciona una corrida</option>
                          {eligible.map((run) => (
                            <option key={run.id} value={run.id}>
                              {run.equipment.name} · {displayLiters(destrozadoProducedLiters(run))} L · {run.id.slice(-6)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="rounded-xl border border-primary px-5 py-3 font-semibold text-primary">Recibir descarga</button>
                    </form>
                  )}
                  {totals.availableLiters > 0.005 && (
                    <form action={makeReady}>
                      <input type="hidden" name="receiverId" value={receiver.id} />
                      <button className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary">Cerrar recepción y habilitar rectificación</button>
                    </form>
                  )}
                </div>
              ) : empty ? (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="font-semibold">Tanque vacío y liberado para seguir trabajando</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Todo el destrozado se cargó a los alambiques. Las rectificaciones conservan su historial.
                    Si recibirás más destrozado de este mismo lote, inicia una nueva recepción usando el mismo tanque físico.
                  </p>
                  <form action={reopen} className="mt-3">
                    <input type="hidden" name="receiverId" value={receiver.id} />
                    <button className="rounded-xl border border-primary px-5 py-3 font-semibold text-primary">Reutilizar este tanque para otra recepción</button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {totals.availableLiters > 0 && availableAlambiques.length >= 2 && (
                    <form action={loadPair} className="rounded-xl border border-outline-variant p-4">
                      <h3 className="font-bold">Cargar dos alambiques desde este tanque</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">Divide el destrozado en dos cargas independientes. El reparto sugerido es la mitad para cada alambique; puedes ajustarlo antes de confirmar.</p>
                      <input type="hidden" name="receiverId" value={receiver.id} />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          Primer alambique
                          <select name="firstEquipmentId" required defaultValue="" className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                            <option value="">Seleccionar alambique</option>
                            {availableAlambiques.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name} · {displayLiters(equipment.capacity)} L</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Litros de primera carga
                          <input name="firstLiters" required type="number" step="0.01" min="0.01" defaultValue={Math.floor(totals.availableLiters * 50) / 100} className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Segundo alambique
                          <select name="secondEquipmentId" required defaultValue="" className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                            <option value="">Seleccionar alambique</option>
                            {availableAlambiques.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name} · {displayLiters(equipment.capacity)} L</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          Litros de segunda carga
                          <input name="secondLiters" required type="number" step="0.01" min="0.01" defaultValue={Number((totals.availableLiters - Math.floor(totals.availableLiters * 50) / 100).toFixed(2))} className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
                        </label>
                      </div>
                      <label className="mt-3 grid gap-1 text-sm font-semibold">
                        Porcentaje máximo de carga por alambique
                        <input name="fillPercent" required type="number" min="1" max="100" step="0.1" defaultValue={80} className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
                      </label>
                      <button className="mt-3 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary">Abrir las dos rectificaciones y descontar el volumen</button>
                    </form>
                  )}
                  <Link href="/distillation/new" className="inline-flex rounded-xl border border-primary px-5 py-3 font-semibold text-primary">
                    Cargar un alambique individualmente
                  </Link>
                </div>
              )}
              {receiver.rectifications.length > 0 && (
                <div className="mt-4 rounded-xl border border-outline-variant p-3">
                  <h3 className="font-semibold">Rectificaciones de esta recepción</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    {receiver.rectifications.map((run) => (
                      <div key={run.id} className="flex flex-wrap justify-between gap-3">
                        <Link href={`/distillation/${run.id}`} className="text-primary underline">{run.equipment.name} · {run.status === "ACTIVA" ? "En proceso" : run.status === "CANCELADA" ? "Cancelada" : "Terminada"}</Link>
                        <span>{displayLiters(run.loadedLiters)} L</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {historicalReceivers.length > 0 && (
          <details className="rounded-xl border border-outline-variant p-4">
            <summary className="cursor-pointer font-semibold">Historial de recepciones anteriores ({historicalReceivers.length})</summary>
            <div className="mt-3 space-y-2 text-sm">
              {historicalReceivers.map((receiver) => {
                const totals = receiverTotals(receiver);
                return (
                  <div key={receiver.id} className="flex justify-between gap-3">
                    <span>{receiver.name} · lote {receiver.lot.code}</span>
                    <span>{displayLiters(totals.receivedLiters)} L recibidos · {displayLiters(totals.availableLiters)} L restantes</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
