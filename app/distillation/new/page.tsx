import { DistillationType } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireModuleActionAccess } from "@/lib/auth";
import { findAvailableEquipment } from "@/lib/equipmentAvailability";
import {
  DistillationOperationError,
  getDistillationSources,
  startDistillationRun,
} from "@/lib/distillation/operations";

export default async function NewDistillationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, sources, equipments] = await Promise.all([
    searchParams,
    getDistillationSources(),
    findAvailableEquipment(["ALAMBIQUE"]),
  ]);

  async function createDistillation(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/distillation");
    const [typeValue, sourceId] = String(formData.get("source") ?? "").split(":");
    const type = typeValue as DistillationType;
    if (!sourceId || !Object.values(DistillationType).includes(type)) {
      redirect("/distillation/new?error=Fuente%20inválida");
    }
    try {
      const run = await startDistillationRun({
        sourceId,
        type,
        equipmentId: String(formData.get("equipmentId") ?? ""),
        loadedLiters: Number(formData.get("loadedLiters")),
        fillPercent: Number(formData.get("fillPercent")),
        initialAlcohol: formData.get("initialAlcohol") ? Number(formData.get("initialAlcohol")) : null,
      });
      redirect(`/distillation/${run.id}?created=1`);
    } catch (caught) {
      if (caught instanceof DistillationOperationError) {
        redirect(`/distillation/new?error=${encodeURIComponent(caught.message)}`);
      }
      throw caught;
    }
  }

  const blockers: string[] = [];
  if (sources.length === 0) blockers.push("No hay volumen pendiente en fermentaciones o destrozados terminados.");
  if (equipments.length === 0) blockers.push("Todos los alambiques están ocupados o fuera de servicio.");

  return (
    <main className="min-h-screen bg-background p-6 text-on-surface sm:p-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">MAESTRO</p>
        <h1 className="mt-3 text-4xl font-bold">Nueva corrida de alambique</h1>
        <p className="mt-3 text-on-surface-variant">
          Puedes abrir varias corridas del mismo lote. Cada carga descuenta litros de su tina o destrozado de origen.
        </p>
        {error && <div className="mt-6 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{decodeURIComponent(error)}</div>}

        {blockers.length > 0 ? (
          <div className="mt-8 space-y-2 rounded-2xl border border-secondary/30 bg-secondary/10 p-8">
            {blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
          </div>
        ) : (
          <form action={createDistillation} className="mt-8 grid gap-5 rounded-2xl bg-surface-container p-8">
            <label className="grid gap-2 text-sm font-semibold">
              Fuente y volumen restante
              <select name="source" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
                <option value="">Selecciona una tina o destrozado</option>
                {sources.map((source) => (
                  <option key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>
                    {source.lotCode} · {source.tankName ?? "Sin tina"} · {source.label} · quedan {source.availableLiters.toLocaleString("es-MX", { maximumFractionDigits: 2 })} L de {source.sourceLiters.toLocaleString("es-MX")} L
                  </option>
                ))}
              </select>
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
              <input name="loadedLiters" type="number" min="0.01" step="0.01" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Alcohol inicial % (opcional)
              <input name="initialAlcohol" type="number" min="0" max="100" step="0.01" className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
            </label>
            <p className="text-xs text-on-surface-variant">El servidor vuelve a comprobar el saldo y la capacidad al guardar; nunca permite sobreasignar una tina.</p>
            <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary">Abrir corrida</button>
          </form>
        )}
      </div>
    </main>
  );
}
