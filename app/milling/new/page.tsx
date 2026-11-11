import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LotStage } from "@prisma/client";
import { advanceLotStage } from "@/lib/lotStage";
import { findAvailableEquipment, reserveEquipment } from "@/lib/equipmentAvailability";
import { requireModuleActionAccess } from "@/lib/auth";
import { MILLING_ALLOWED_LOT_STAGES, suggestedMillingCookedKg } from "@/lib/milling/eligibleLots";

export default async function NewMillingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const lots = await prisma.lot.findMany({
    where: {
      stage: { in: MILLING_ALLOWED_LOT_STAGES },
      finishedAt: null,
      cookings: {
        some: { status: "TERMINADA" },
      },
    },
    include: {
      cookings: {
        where: { status: "TERMINADA" },
        select: { finalAgaveKg: true, agaveKg: true },
      },
      millings: { select: { cookedKg: true } },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const equipments = await findAvailableEquipment(["DESGARRADORA", "PRENSA"]);

  async function createMilling(formData: FormData) {
    "use server";

    const user = await requireModuleActionAccess("/milling");

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const cookedKg = Number(formData.get("cookedKg"));
    if (!Number.isFinite(cookedKg) || cookedKg <= 0) {
      redirect("/milling/new?error=kilos-invalidos");
    }

    const milling = await prisma.$transaction(async (tx) => {
      // Comprobar nuevamente el lote para evitar crear registros tras su cierre.
      const eligibleLot = await tx.lot.findFirst({
        where: {
          id: lotId,
          stage: { in: MILLING_ALLOWED_LOT_STAGES },
          finishedAt: null,
          cookings: { some: { status: "TERMINADA" } },
        },
        select: { id: true },
      });
      if (!eligibleLot) return { error: "lote-no-disponible" } as const;

      const duplicate = await tx.milling.findFirst({
        where: { lotId, status: { not: "TERMINADA" } },
        select: { id: true },
      });
      if (duplicate) return { id: duplicate.id };
      const availableEquipment = await tx.equipment.findFirst({
        where: {
          id: equipmentId,
          type: { in: ["DESGARRADORA", "PRENSA"] },
          active: true,
          status: "DISPONIBLE",
        },
        select: { id: true },
      });
      if (!availableEquipment) return { error: "equipo-ocupado" } as const;
      const reserved = await reserveEquipment(tx, equipmentId, cookedKg);
      if (!reserved) return { error: "equipo-ocupado" } as const;
      const created = await tx.milling.create({ data: { lotId, equipmentId, cookedKg } });
      await tx.millingWorkSession.create({
        data: {
          millingId: created.id,
          startedById: user.id,
          startOperationId: crypto.randomUUID(),
        },
      });
      await advanceLotStage(tx, lotId, LotStage.MOLIENDA);
      return { id: created.id };
    });

    if ("error" in milling) redirect(`/milling/new?error=${milling.error}`);

    redirect(`/milling/${milling.id}?created=1`);
  }

  const blockers: string[] = [];

  if (lots.length === 0) {
    blockers.push(
      "No hay lotes abiertos con cocción terminada. Un lote ya finalizado no permite nuevas moliendas.",
    );
  }

  if (equipments.length === 0) {
    blockers.push(
      "Todos los molinos y prensas están ocupados o fuera de servicio. Libera uno para poder continuar.",
    );
  }

  if (blockers.length > 0) {
    return (
      <main className="min-h-screen bg-background p-10 text-on-surface">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
            MAESTRO
          </p>

          <h1 className="mt-2 mb-8 text-4xl font-bold">Nueva molienda</h1>

          <div className="space-y-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-8">
            <h2 className="text-xl font-bold text-secondary">
              Todavía no se puede iniciar una molienda
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
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-2 mb-4 text-4xl font-bold">
          Nueva molienda
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Registra una molienda por jornada. Puedes utilizar el mismo lote
          durante varios días y descargar el mosto en tinas diferentes.
        </p>
        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
            {error === "equipo-ocupado"
              ? "El equipo ya está ocupado. Selecciona uno disponible."
              : error === "kilos-invalidos"
                ? "Ingresa los kilos realmente molidos hoy (mayor a cero)."
                : "Este lote ya no está disponible para nuevas moliendas. Actualiza la página."}
          </p>
        )}

        <form action={createMilling} className="space-y-6">

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Lote</label>

            <select
              name="lotId"
              id="lotId"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Selecciona un lote</option>

              {lots.map((lot) => {
                const totalCookedKg = lot.cookings.reduce(
                  (sum, cooking) => sum + (cooking.finalAgaveKg ?? cooking.agaveKg), 0
                );
                const suggestedKg = suggestedMillingCookedKg(totalCookedKg, lot.millings.length);

                return (
                  <option
                    key={lot.id}
                    value={lot.id}
                    data-cooked-kg={suggestedKg ?? ""}
                  >
                    {lot.code}
                    {totalCookedKg > 0
                      ? ` — ${totalCookedKg.toLocaleString("es-MX")} kg cocidos en el lote`
                      : ""}
                    {lot.millings.length > 0
                      ? ` · ${lot.millings.length} molienda(s) registrada(s)`
                      : ""}
                  </option>
                );
              })}
            </select>

            {lots.length === 0 && (
              <p className="mt-2 text-sm text-on-surface-variant">
                No hay lotes con una cocción terminada
                lista para moler.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Equipo</label>

            <select
              name="equipmentId"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Selecciona un equipo</option>

              {equipments.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Kg cocidos que molerás en esta jornada</label>

            <input
              type="number"
              step="0.01"
              min="0.01"
              name="cookedKg"
              id="cookedKg"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />

            <p className="mt-1 text-xs text-outline">
              Captura solamente los kilos de esta molienda, no los kilos totales del lote.
              En jornadas posteriores se deja vacío para evitar duplicaciones.
            </p>
          </div>

          <button className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]">
            Iniciar molienda
          </button>

        </form>

        <script
          // Sugiere el kg cocido real de la cocción terminada
          // del lote seleccionado, sin necesitar un componente cliente.
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var lotSelect = document.getElementById("lotId");
                var cookedKgInput = document.getElementById("cookedKg");
                if (!lotSelect || !cookedKgInput) return;
                lotSelect.addEventListener("change", function () {
                  var option = lotSelect.options[lotSelect.selectedIndex];
                  var suggested = option ? option.getAttribute("data-cooked-kg") : "";
                  cookedKgInput.value = suggested || "";
                });
              })();
            `,
          }}
        />
      </div>
    </main>
  );
}
