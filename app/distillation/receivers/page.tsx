import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModuleActionAccess } from "@/lib/auth";
import {
  destrozadoProducedLiters,
  receiveExistingDestrozado,
  receiverTotals,
  registerReceiver,
  sealReceiver,
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
  const [receivers, lots, availableDestrozados] = await Promise.all([
    prisma.distillationReceiver.findMany({
      include: {
        lot: { select: { code: true } },
        transfers: {
          include: { distillation: { include: { equipment: { select: { name: true } } } } },
          orderBy: { createdAt: "asc" },
        },
        rectifications: { select: { loadedLiters: true, status: true } },
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
  ]);

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

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href="/distillation" className="text-sm text-primary underline">Volver a destilación</Link>
          <h1 className="mt-3 text-3xl font-bold">Tanques de recepción de destrozado</h1>
          <p className="mt-2 text-on-surface-variant">
            Reúne las descargas terminadas del mismo lote y, cuando termines de recibirlas,
            marca el tanque como listo para rectificar. El saldo se descuenta por cada nueva carga.
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Los destrozados ya terminados pueden incorporarse aquí; no es necesario volver a registrarlos.
          </p>
        </header>
        {error && <div role="alert" className="rounded-xl border border-error/40 bg-error/10 p-4 text-error">{error}</div>}
        {saved && <div role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-4">Movimiento guardado correctamente.</div>}

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-xl font-bold">Registrar tanque receptor</h2>
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
              <input name="name" required maxLength={80} placeholder="Ej. Receptor destrozado 1" className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Capacidad en litros
              <input name="capacityLiters" type="number" min="1" step="0.01" required className="rounded-xl border border-outline-variant bg-surface-container-high p-3" />
            </label>
            <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary sm:col-span-4">Crear tanque</button>
          </form>
        </section>

        {receivers.length === 0 && (
          <p className="rounded-2xl border border-outline-variant p-6">Aún no hay tanques receptores registrados.</p>
        )}
        {receivers.map((receiver) => {
          const totals = receiverTotals(receiver);
          const eligible = availableDestrozados.filter((run) =>
            run.lotId === receiver.lotId && destrozadoProducedLiters(run) > 0
          );
          return (
            <section key={receiver.id} className="rounded-2xl border border-outline-variant bg-surface-container p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{receiver.name}</h2>
                  <p className="text-sm text-on-surface-variant">Lote {receiver.lot.code} · {receiver.status === "OPEN" ? "Recibiendo destrozado" : "Listo para rectificar"}</p>
                </div>
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-semibold">
                  {displayLiters(totals.availableLiters)} L disponibles
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
                  {totals.receivedLiters > 0 && (
                    <form action={makeReady}>
                      <input type="hidden" name="receiverId" value={receiver.id} />
                      <button className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary">Cerrar recepción y habilitar rectificación</button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <Link href="/distillation/new" className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary">
                    Nueva rectificación desde este tanque
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
