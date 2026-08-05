import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EquipmentStatus, LotStage } from "@prisma/client";
import { advanceLotStage } from "@/lib/lotStage";

export default async function NewMillingPage() {
  const lots = await prisma.lot.findMany({
    where: {
      stage: {
        in: ["COCCION", "MOLIENDA"],
      },
      cookings: {
        some: { status: "TERMINADA" },
      },
    },
    include: {
      cookings: {
        where: { status: "TERMINADA" },
        orderBy: { finishedAt: "desc" },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const equipments = await prisma.equipment.findMany({
    where: {
      type: {
        in: ["DESGARRADORA", "PRENSA"],
      },
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  async function createMilling(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const cookedKg = Number(formData.get("cookedKg"));

    const milling = await prisma.milling.create({
      data: {
        lotId,
        equipmentId,
        cookedKg,
      },
    });

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status: EquipmentStatus.OPERANDO,
        currentLoad: cookedKg,
      },
    });

    await advanceLotStage(prisma, lotId, LotStage.MOLIENDA);

    redirect(`/milling/${milling.id}`);
  }

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-2 mb-8 text-4xl font-bold">
          Nueva molienda
        </h1>

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
                const finishedCooking = lot.cookings[0];

                return (
                  <option
                    key={lot.id}
                    value={lot.id}
                    data-cooked-kg={
                      finishedCooking?.finalAgaveKg ?? ""
                    }
                  >
                    {lot.code}
                    {finishedCooking?.finalAgaveKg
                      ? ` — ${finishedCooking.finalAgaveKg.toLocaleString()} kg cocidos`
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
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Kg cocidos</label>

            <input
              type="number"
              step="0.01"
              name="cookedKg"
              id="cookedKg"
              required
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />

            <p className="mt-1 text-xs text-outline">
              Se sugiere automáticamente con el kg final
              registrado al cerrar la cocción del lote.
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
                  if (suggested) cookedKgInput.value = suggested;
                });
              })();
            `,
          }}
        />
      </div>
    </main>
  );
}