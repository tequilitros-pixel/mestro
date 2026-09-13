import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LotStage } from "@prisma/client";
import { advanceLotStage } from "@/lib/lotStage";

type FermentationSource = {
  key: string;
  lotId: string;
  lotCode: string;
  tankName: string;
  liters: number;
  brix: number;
  ph: number;
  temperature: number;
};
type DischargeForAverage = {
  litersRecovered: number;
  brix: number;
  ph: number;
  temperature: number;
};

function avg(
  items: DischargeForAverage[],
  field: "brix" | "ph" | "temperature"
) {
  const totalLiters = items.reduce((sum, item) => sum + item.litersRecovered, 0);
  if (totalLiters === 0) return 0;

  return (
    items.reduce(
      (sum, item) => sum + item.litersRecovered * item[field],
      0
    ) / totalLiters
  );
}

export default async function NewFermentationPage() {
  const [discharges, existingFermentations] = await Promise.all([
    prisma.millingDischarge.findMany({
      include: {
        tank: true,
        milling: {
          include: {
            lot: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    /*
     * Una descarga de molienda (lote + tina) solo debe poder
     * iniciar UNA fermentación. Sin esto, la misma tina de
     * mosto podría usarse dos veces por accidente.
     */
    prisma.fermentation.findMany({
      select: { lotId: true, tank: true },
    }),
  ]);

  const usedSources = new Set(
    existingFermentations.map(
      (fermentation) => `${fermentation.lotId}-${fermentation.tank}`
    )
  );

  const availableDischarges = discharges.filter((discharge) => {
    const tankName = discharge.tank?.name ?? "Sin tina";
    return !usedSources.has(`${discharge.milling.lotId}-${tankName}`);
  });

  const grouped = new Map<string, typeof discharges>();

  for (const discharge of availableDischarges) {
    const key = `${discharge.milling.lotId}-${discharge.tankId ?? "sin-tina"}`;
    const current = grouped.get(key) ?? [];
    current.push(discharge);
    grouped.set(key, current);
  }

  const sources: FermentationSource[] = Array.from(grouped.values()).map(
    (items) => {
      const first = items[0];
      const liters = items.reduce(
        (sum, item) => sum + item.litersRecovered,
        0
      );

      return {
        key: `${first.milling.lotId}-${first.tankId ?? "sin-tina"}`,
        lotId: first.milling.lotId,
        lotCode: first.milling.lot.code,
        tankName: first.tank?.name ?? "Sin tina",
        liters,
        brix: avg(items, "brix"),
        ph: avg(items, "ph"),
        temperature: avg(items, "temperature"),
      };
    }
  );

  async function createFermentation(formData: FormData) {
    "use server";

    const sourceRaw = formData.get("source") as string;
    const yeast = formData.get("yeast") as string;

    const source = JSON.parse(sourceRaw) as FermentationSource;

    await prisma.fermentation.create({
      data: {
        lotId: source.lotId,
        tank: source.tankName,
        mustLiters: source.liters,
        initialBrix: source.brix,
        initialPh: source.ph,
        initialTemperature: source.temperature,
        yeast: yeast || null,
        inoculatedAt: new Date(),
      },
    });

    await advanceLotStage(prisma, source.lotId, LotStage.FERMENTACION);

    redirect("/fermentation?created=1");
  }

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nueva fermentación</h1>

        <form
          action={createFermentation}
          className="mt-8 grid gap-5 rounded-2xl bg-surface-container p-8"
        >
          <label className="text-sm font-semibold text-on-surface-variant">
            Crear desde mosto recibido
          </label>

          <select
            name="source"
            required
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Selecciona una tina con mosto</option>

            {sources.map((source) => (
              <option key={source.key} value={JSON.stringify(source)}>
                {source.tankName} · {source.lotCode} ·{" "}
                {source.liters.toLocaleString()} L ·{" "}
                {source.brix.toFixed(2)} °Bx · pH{" "}
                {source.ph.toFixed(2)}
              </option>
            ))}
          </select>

          {sources.length === 0 && (
            <p className="text-sm text-outline">
              No hay mosto disponible para fermentar. Cada tina de
              mosto solo puede usarse una vez.
            </p>
          )}

          <input
            name="yeast"
            placeholder="Levadura utilizada"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />

          <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]">
            Iniciar fermentación
          </button>
        </form>
      </div>
    </main>
  );
}