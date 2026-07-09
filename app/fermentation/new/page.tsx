import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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
  const discharges = await prisma.millingDischarge.findMany({
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
  });

  const grouped = new Map<string, typeof discharges>();

  for (const discharge of discharges) {
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

    redirect("/fermentation");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nueva fermentación</h1>

        <form
          action={createFermentation}
          className="mt-8 grid gap-5 rounded-2xl bg-slate-900 p-8"
        >
          <label className="text-sm font-bold text-slate-300">
            Crear desde mosto recibido
          </label>

          <select
            name="source"
            required
            className="rounded-xl bg-slate-800 p-3"
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

          <input
            name="yeast"
            placeholder="Levadura utilizada"
            className="rounded-xl bg-slate-800 p-3"
          />

          <button className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black">
            Iniciar fermentación
          </button>
        </form>
      </div>
    </main>
  );
}