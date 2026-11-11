import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LotStage } from "@prisma/client";
import { advanceLotStage } from "@/lib/lotStage";
import { findAvailableEquipment, reserveEquipment } from "@/lib/equipmentAvailability";
import { requireModuleActionAccess } from "@/lib/auth";
import { MILLING_ALLOWED_LOT_STAGES } from "@/lib/milling/eligibleLots";

export default async function NewMillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ lotId?: string; error?: string }>;
}) {
  const { lotId: queryLotId, error } = (await searchParams) ?? {};

  const lots = await prisma.lot.findMany({
    where: {
      archivedAt: null,
      finishedAt: null,
      stage: { in: MILLING_ALLOWED_LOT_STAGES },
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

  // El mismo lote puede tener varias moliendas cerradas, cada una con su propio peso.
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
      // Revalidar: el lote pudo archivarse o terminar mientras se llenaba el formulario.
      const lot = await tx.lot.findFirst({
        where: {
          id: lotId,
          archivedAt: null,
          finishedAt: null,
          stage: { in: MILLING_ALLOWED_LOT_STAGES },
          cookings: { some: { status: "TERMINADA" } },
        },
        select: { id: true },
      });
      if (!lot) return { error: "lote-no-disponible" } as const;
      const duplicate = await tx.milling.findFirst({
        where: { lotId, status: { not: "TERMINADA" } },
        select: { id: true },
      });
      if (duplicate) return { id: duplicate.id };
      const equipment = await tx.equipment.findFirst({
        where: {
          id: equipmentId,
          active: true,
          type: { in: ["DESGARRADORA", "PRENSA"] },
          status: "DISPONIBLE",
        },
        select: { id: true },
      });
      if (!equipment) return { error: "equipo-ocupado" } as const;
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
      "No hay lotes abiertos con una cocción terminada. Los lotes finalizados o archivados no permiten nuevas moliendas.",
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
          Puedes iniciar varias moliendas del mismo lote, una por jornada,
          y enviar el mosto a tinas diferentes.
        </p>
        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
            {error === "equipo-ocupado"
              ? "El equipo ya está ocupado. Selecciona uno disponible."
              : error === "kilos-invalidos"
                ? "Ingresa los kilos de agave realmente molidos en esta jornada."
                : "El lote ya no está disponible para una nueva molienda."}
          </p>
        )}

        <form action={createMilling} className="space-y-6">

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Lote</label>

            <select
              name="lotId"
              id="lotId"
              defaultValue={lots.some((lot) => lot.id === queryLotId) ? queryLotId : ""}
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Selecciona un lote</option>

              {lots.map((lot) => {
                const totalCookedKg = lot.cookings.reduce(
                  (sum, cooking) => sum + (cooking.finalAgaveKg ?? cooking.agaveKg),
                  0,
                );

                return (
                  <option
                    key={lot.id}
                    value={lot.id}
                  >
                    {lot.code}
                    {totalCookedKg > 0 ? ` — ${totalCookedKg.toLocaleString("es-MX")} kg cocidos en el lote` : ""}
                    {lot.millings.length > 0 ? ` · ${lot.millings.length} molienda(s) registrada(s)` : ""}
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
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Kg cocidos para esta jornada</label>

            <input
              type="number"
              step="0.01"
              min="0.01"
              name="cookedKg"
              id="cookedKg"
              placeholder="Kilos realmente molidos hoy"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />

            <p className="mt-1 text-xs text-outline">
              Captura únicamente los kilos de esta molienda, no los kilos totales
              del lote, para evitar duplicarlos entre jornadas.
            </p>
          </div>

          <button className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]">
            Iniciar molienda
          </button>

        </form>
      </div>
    </main>
  );
}
