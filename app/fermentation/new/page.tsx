import { LotStage, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireModuleActionAccess } from "@/lib/auth";
import { advanceLotStage } from "@/lib/lotStage";
import { prisma } from "@/lib/prisma";

type Discharge = {
  litersRecovered: number;
  brix: number;
  ph: number;
  temperature: number;
};

function weighted(items: Discharge[], key: "brix" | "ph" | "temperature") {
  const liters = items.reduce((sum, item) => sum + item.litersRecovered, 0);
  return liters > 0 ? items.reduce((sum, item) => sum + item[key] * item.litersRecovered, 0) / liters : 0;
}

export default async function NewFermentationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const discharges = await prisma.millingDischarge.findMany({
    where: {
      tankId: { not: null },
      milling: { status: "TERMINADA" },
    },
    include: { tank: true, milling: { include: { lot: true } } },
    orderBy: { createdAt: "asc" },
  });
  const existing = await prisma.fermentation.findMany({
    where: { tankId: { not: null } },
    select: { lotId: true, tankId: true },
  });
  const used = new Set(existing.map((item) => `${item.lotId}:${item.tankId}`));
  const grouped = new Map<string, typeof discharges>();
  for (const discharge of discharges) {
    const key = `${discharge.milling.lotId}:${discharge.tankId}`;
    if (used.has(key)) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), discharge]);
  }
  const sources = Array.from(grouped.entries()).map(([key, items]) => ({
    key,
    lotId: items[0].milling.lotId,
    lotCode: items[0].milling.lot.code,
    tankId: items[0].tankId!,
    tankName: items[0].tank!.name,
    liters: items.reduce((sum, item) => sum + item.litersRecovered, 0),
    brix: weighted(items, "brix"),
    ph: weighted(items, "ph"),
    temperature: weighted(items, "temperature"),
  }));

  async function createFermentation(formData: FormData) {
    "use server";
    await requireModuleActionAccess("/fermentation");
    const [lotId, tankId] = String(formData.get("source") ?? "").split(":");
    if (!lotId || !tankId) redirect("/fermentation/new?error=Fuente%20inválida");

    try {
      const fermentation = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Equipment" WHERE "id" = ${tankId} FOR UPDATE`);
        const [tank, sourceItems, duplicate] = await Promise.all([
          tx.equipment.findFirst({ where: { id: tankId, type: "TINA", active: true } }),
          tx.millingDischarge.findMany({ where: { tankId, milling: { lotId, status: "TERMINADA" } } }),
          tx.fermentation.findFirst({ where: { lotId, tankId } }),
        ]);
        if (!tank || duplicate || sourceItems.length === 0) throw new Error("SOURCE_UNAVAILABLE");
        const items = sourceItems.map((item) => ({
          litersRecovered: item.litersRecovered,
          brix: item.brix,
          ph: item.ph,
          temperature: item.temperature,
        }));
        const liters = items.reduce((sum, item) => sum + item.litersRecovered, 0);
        const created = await tx.fermentation.create({
          data: {
            lotId,
            tankId,
            tank: tank.name,
            mustLiters: liters,
            initialBrix: weighted(items, "brix"),
            initialPh: weighted(items, "ph"),
            initialTemperature: weighted(items, "temperature"),
            yeast: String(formData.get("yeast") ?? "").trim() || null,
            inoculatedAt: new Date(),
          },
        });
        await advanceLotStage(tx, lotId, LotStage.FERMENTACION);
        return created;
      });
      redirect(`/fermentation/${fermentation.id}?created=1`);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "SOURCE_UNAVAILABLE") {
        redirect("/fermentation/new?error=La%20tina%20ya%20fue%20utilizada");
      }
      throw caught;
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 text-on-surface sm:p-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">MAESTRO</p>
        <h1 className="mt-3 text-4xl font-bold">Nueva fermentación</h1>
        <p className="mt-3 text-on-surface-variant">Cada tina del lote conserva su propia bitácora y después puede alimentar varias corridas de alambique.</p>
        {error && <p className="mt-6 rounded-xl border border-error/40 bg-error/10 p-4 text-error">{decodeURIComponent(error)}</p>}
        <form action={createFermentation} className="mt-8 grid gap-5 rounded-2xl bg-surface-container p-8">
          <label className="grid gap-2 text-sm font-semibold">
            Tina con mosto
            <select name="source" required className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">
              <option value="">Selecciona una tina</option>
              {sources.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.lotCode} · {source.tankName} · {source.liters.toLocaleString("es-MX")} L · {source.brix.toFixed(2)} °Bx
                </option>
              ))}
            </select>
          </label>
          {sources.length === 0 && <p className="text-sm text-on-surface-variant">No hay tinas nuevas con molienda terminada.</p>}
          <input name="yeast" placeholder="Levadura utilizada" className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3" />
          <button disabled={sources.length === 0} className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary disabled:opacity-40">Iniciar fermentación</button>
        </form>
      </div>
    </main>
  );
}
