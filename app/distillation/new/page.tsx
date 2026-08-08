import { prisma } from "@/lib/prisma";
import { DistillationType, LotStage } from "@prisma/client";
import { redirect } from "next/navigation";
import { advanceLotStage } from "@/lib/lotStage";
import { findAvailableEquipment, reserveEquipment } from "@/lib/equipmentAvailability";

type DistillationSource = {
  key: string;
  lotId: string;
  lotCode: string;
  type: DistillationType;
  typeLabel: string;
  loadedLiters: number;
  initialAlcohol: number | null;
};

export default async function NewDistillationPage() {
  const [
    finishedFermentations,
    finishedDestrozados,
    existingDistillations,
  ] = await Promise.all([
    // Fermentaciones terminadas: listas para destrozado.
    prisma.fermentation.findMany({
      where: { status: "TERMINADA" },
      include: { lot: true },
      orderBy: { finishedAt: "desc" },
    }),
    // Destrozados terminados: listos para rectificación.
    prisma.distillation.findMany({
      where: { status: "TERMINADA", type: "DESTROZADO" },
      include: { lot: true },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.distillation.findMany({
      select: { lotId: true, type: true },
    }),
  ]);

  const usedTypes = new Set(
    existingDistillations.map((d) => `${d.lotId}-${d.type}`)
  );

  const sources: DistillationSource[] = [];

  for (const fermentation of finishedFermentations) {
    if (usedTypes.has(`${fermentation.lotId}-DESTROZADO`)) continue;

    sources.push({
      key: `${fermentation.lotId}-DESTROZADO`,
      lotId: fermentation.lotId,
      lotCode: fermentation.lot.code,
      type: "DESTROZADO",
      typeLabel: "Destrozado",
      loadedLiters: fermentation.mustLiters,
      initialAlcohol: fermentation.finalAlcohol ?? null,
    });
  }

  for (const destrozado of finishedDestrozados) {
    if (usedTypes.has(`${destrozado.lotId}-RECTIFICACION`)) continue;

    /*
     * Litros que pasan a rectificación: el corazón si se cortó, y si
     * no, el total obtenido.
     *
     * OJO con el `??`: solo cae al respaldo cuando el valor es null,
     * NO cuando es 0. Un destrozado cerrado sin registrar cortes deja
     * `finalHeartLiters` en 0, y con `??` el destrozado quedaba fuera
     * de la lista para siempre — el lote se atoraba sin poder
     * rectificarse y sin ningún aviso.
     */
    const heartLiters =
      destrozado.finalHeartLiters && destrozado.finalHeartLiters > 0
        ? destrozado.finalHeartLiters
        : destrozado.finalLiters;

    if (!heartLiters || heartLiters <= 0) continue;

    sources.push({
      key: `${destrozado.lotId}-RECTIFICACION`,
      lotId: destrozado.lotId,
      lotCode: destrozado.lot.code,
      type: "RECTIFICACION",
      typeLabel: "Rectificación",
      loadedLiters: heartLiters,
      initialAlcohol: destrozado.finalAlcohol ?? null,
    });
  }

  const equipments = await findAvailableEquipment(["ALAMBIQUE"]);

  async function createDistillation(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const type = formData.get("type") as DistillationType;
    const loadedLiters = Number(formData.get("loadedLiters"));
    const initialAlcoholRaw = formData.get("initialAlcohol");
    const initialAlcohol =
      initialAlcoholRaw && initialAlcoholRaw !== ""
        ? Number(initialAlcoholRaw)
        : null;

    const reserved = await reserveEquipment(prisma, equipmentId, loadedLiters);

    if (!reserved) {
      redirect("/distillation/new?error=equipo-ocupado");
    }

    const distillation = await prisma.distillation.create({
      data: {
        lotId,
        equipmentId,
        type,
        loadedLiters,
        initialAlcohol,
      },
    });

    await advanceLotStage(
      prisma,
      lotId,
      type === "RECTIFICACION"
        ? LotStage.RECTIFICACION
        : LotStage.DESTILACION
    );

    redirect(`/distillation/${distillation.id}`);
  }

  const blockers: string[] = [];

  if (sources.length === 0) {
    blockers.push(
      "No hay fermentaciones ni destrozados terminados esperando alambique. Cierra la etapa anterior del lote que quieres destilar.",
    );
  }

  if (equipments.length === 0) {
    blockers.push(
      "Todos los alambiques están ocupados o fuera de servicio. Libera uno para poder continuar.",
    );
  }

  if (blockers.length > 0) {
    return (
      <main className="min-h-screen bg-background p-10 text-on-surface">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
            MAESTRO
          </p>

          <h1 className="mt-3 text-4xl font-bold">Nueva destilación</h1>

          <div className="mt-8 space-y-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-8">
            <h2 className="text-xl font-bold text-secondary">
              Todavía no se puede iniciar una destilación
            </h2>

            {blockers.map((blocker) => (
              <p key={blocker} className="text-sm text-on-surface-variant">
                {blocker}
              </p>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nueva destilación</h1>

        <form
          action={createDistillation}
          className="mt-8 grid gap-5 rounded-2xl bg-surface-container p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Lote listo para destilar
            </label>

            <select
              id="source"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Selecciona un lote</option>

              {sources.map((source) => (
                <option
                  key={source.key}
                  value={source.key}
                  data-lot-id={source.lotId}
                  data-type={source.type}
                  data-liters={source.loadedLiters}
                  data-alcohol={source.initialAlcohol ?? ""}
                >
                  {source.lotCode} · {source.typeLabel} ·{" "}
                  {source.loadedLiters.toLocaleString()} L
                  {source.initialAlcohol !== null
                    ? ` · ${source.initialAlcohol.toFixed(1)}% alcohol`
                    : ""}
                </option>
              ))}
            </select>

            {sources.length === 0 && (
              <p className="mt-2 text-sm text-outline">
                No hay lotes listos para destilar. Un lote aparece
                aquí cuando termina una fermentación (destrozado) o
                un destrozado (rectificación).
              </p>
            )}
          </div>

          <input type="hidden" name="lotId" id="lotId" />
          <input type="hidden" name="type" id="type" />

          <select
            name="equipmentId"
            required
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Selecciona un alambique</option>
            {equipments.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Litros cargados
            </label>
            <input
              name="loadedLiters"
              id="loadedLiters"
              type="number"
              step="0.01"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Alcohol inicial % (opcional)
            </label>
            <input
              name="initialAlcohol"
              id="initialAlcohol"
              type="number"
              step="0.01"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]">
            Crear destilación
          </button>
        </form>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var sourceSelect = document.getElementById("source");
                var lotIdInput = document.getElementById("lotId");
                var typeInput = document.getElementById("type");
                var litersInput = document.getElementById("loadedLiters");
                var alcoholInput = document.getElementById("initialAlcohol");
                if (!sourceSelect) return;
                sourceSelect.addEventListener("change", function () {
                  var option = sourceSelect.options[sourceSelect.selectedIndex];
                  if (!option) return;
                  lotIdInput.value = option.getAttribute("data-lot-id") || "";
                  typeInput.value = option.getAttribute("data-type") || "";
                  litersInput.value = option.getAttribute("data-liters") || "";
                  alcoholInput.value = option.getAttribute("data-alcohol") || "";
                });
              })();
            `,
          }}
        />
      </div>
    </main>
  );
}
