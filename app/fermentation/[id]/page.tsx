import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";
import { FermentationStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import FermentationCharts from "@/components/FermentationCharts";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FermentationDetailPage({ params }: Props) {
  const { id } = await params;

  const fermentation = await prisma.fermentation.findUnique({
    where: { id },
    include: {
      lot: true,
      readings: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!fermentation) notFound();

  const last = fermentation.readings[0];

  async function addReading(formData: FormData) {
    "use server";

    const brix = formData.get("brix");
    const ph = formData.get("ph");
    const temperature = formData.get("temperature");
    const alcohol = formData.get("alcohol");
    const saccharometer = formData.get("saccharometer");
    const citricAcidGrams = formData.get("citricAcidGrams");
    const bicarbonateGrams = formData.get("bicarbonateGrams");
    const heatingMinutes = formData.get("heatingMinutes");
    const notes = formData.get("notes") as string;

    await prisma.fermentationReading.create({
      data: {
        fermentationId: id,
        brix: brix ? Number(brix) : null,
        ph: ph ? Number(ph) : null,
        temperature: temperature ? Number(temperature) : null,
        alcohol: alcohol ? Number(alcohol) : null,
        saccharometer: saccharometer ? Number(saccharometer) : null,
        citricAcidGrams: citricAcidGrams ? Number(citricAcidGrams) : null,
        bicarbonateGrams: bicarbonateGrams ? Number(bicarbonateGrams) : null,
        heated: !!heatingMinutes,
        heatingMinutes: heatingMinutes ? Number(heatingMinutes) : null,
        notes: notes || null,
      },
    });

    redirect(`/fermentation/${id}`);
  }

  async function finishFermentation() {
    "use server";

    await prisma.fermentation.update({
      where: { id },
      data: {
        status: FermentationStatus.TERMINADA,
        finishedAt: new Date(),
      },
    });

    redirect(`/fermentation/${id}`);
  }

  const currentBrix = last?.brix ?? fermentation.initialBrix;
  const currentPh = last?.ph ?? fermentation.initialPh;
  const currentTemp = last?.temperature ?? fermentation.initialTemperature;
  const currentAlcohol = last?.alcohol ?? "-";
  const currentSaccharometer = last?.saccharometer ?? "-";
  

  const totalAcid = fermentation.readings.reduce(
    (sum, reading) => sum + (reading.citricAcidGrams ?? 0),
    0
  );

  const totalBicarbonate = fermentation.readings.reduce(
    (sum, reading) => sum + (reading.bicarbonateGrams ?? 0),
    0
  );

  const totalHeatingMinutes = fermentation.readings.reduce(
    (sum, reading) => sum + (reading.heatingMinutes ?? 0),
    0
  );

  const isFinished = fermentation.status === "TERMINADA";

  const progress =
    fermentation.initialBrix > 2
      ? Math.min(
          100,
          Math.max(
            0,
            ((fermentation.initialBrix - Number(currentBrix)) /
              (fermentation.initialBrix - 2)) *
              100
          )
        )
      : 0;

  const temperatureStatus =
    Number(currentTemp) > 35 ? "ALTA" : Number(currentTemp) < 25 ? "BAJA" : "OK";

  const phStatus =
    Number(currentPh) > 5 ? "ALTO" : Number(currentPh) < 3.8 ? "BAJO" : "OK";

  const brixStatus =
    Number(currentBrix) <= 2
      ? "LISTA"
      : Number(currentBrix) <= 5
        ? "CASI_LISTA"
        : "FERMENTANDO";

  const health =
    temperatureStatus !== "OK" || phStatus !== "OK"
      ? "ATENCION"
      : brixStatus === "LISTA"
        ? "LISTA"
        : "SALUDABLE";

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Fermentación {fermentation.lot.code}
        </h1>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Kpi title="Tina" value={fermentation.tank} />
          <Kpi title="Mosto" value={`${fermentation.mustLiters} L`} />
          <Kpi title="Estado" value={fermentation.status} highlight />
          <Kpi title="Lecturas" value={fermentation.readings.length} />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-5">
          <Kpi title="°Brix actual" value={currentBrix} />
          <Kpi title="pH actual" value={currentPh} />
          <Kpi title="Temperatura" value={`${currentTemp}°C`} />
          <Kpi title="Alcohol" value={currentAlcohol} />
          <Kpi title="Sacarímetro" value={currentSaccharometer} />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Kpi title="Ácido total" value={`${totalAcid} g`} />
          <Kpi title="Bicarbonato total" value={`${totalBicarbonate} g`} />
          <Kpi title="Calentamiento total" value={`${totalHeatingMinutes} min`} />
        </section>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avance de fermentación</p>
              <p className="mt-1 text-3xl font-bold">{progress.toFixed(0)}%</p>
            </div>

            <div className="text-right text-sm text-slate-400">
              <p>Inicial: {fermentation.initialBrix} °Brix</p>
              <p>Actual: {currentBrix} °Brix</p>
              <p>Meta: 2 °Brix</p>
            </div>
          </div>

          <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Estado inteligente</p>

          <h2
            className={`mt-2 text-3xl font-bold ${
              health === "ATENCION"
                ? "text-red-400"
                : health === "LISTA"
                  ? "text-green-400"
                  : "text-amber-400"
            }`}
          >
            {health === "ATENCION"
              ? "🔴 Revisar fermentación"
              : health === "LISTA"
                ? "🟢 Lista para destilar"
                : "🟡 Fermentación saludable"}
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Mini title="Temperatura" value={temperatureStatus} />
            <Mini title="pH" value={phStatus} />
            <Mini title="°Brix" value={brixStatus} />
          </div>
        </section>

        {!isFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">➕ Registrar lectura</h2>

            <form action={addReading} className="grid gap-4 md:grid-cols-2">
              <input name="brix" type="number" step="0.01" placeholder="°Brix" className="rounded-xl bg-slate-800 p-3" />
              <input name="ph" type="number" step="0.01" placeholder="pH" className="rounded-xl bg-slate-800 p-3" />
              <input name="temperature" type="number" step="0.01" placeholder="Temperatura °C" className="rounded-xl bg-slate-800 p-3" />
              <input name="alcohol" type="number" step="0.01" placeholder="% Alcohol" className="rounded-xl bg-slate-800 p-3" />
              <input name="saccharometer" type="number" step="0.01" placeholder="Sacarímetro / Densímetro" className="rounded-xl bg-slate-800 p-3" />
              <input name="citricAcidGrams" type="number" step="0.01" placeholder="Ácido cítrico agregado g" className="rounded-xl bg-slate-800 p-3" />
              <input name="bicarbonateGrams" type="number" step="0.01" placeholder="Bicarbonato agregado g" className="rounded-xl bg-slate-800 p-3" />
              <input name="heatingMinutes" type="number" placeholder="Minutos de calentamiento" className="rounded-xl bg-slate-800 p-3" />
              <input name="notes" placeholder="Observaciones" className="rounded-xl bg-slate-800 p-3 md:col-span-2" />

              <button className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black md:col-span-2">
                Guardar lectura
              </button>
            </form>

            <form action={finishFermentation} className="mt-4">
              <button className="w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-black">
                Finalizar fermentación
              </button>
            </form>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold">Bitácora</h2>

          {fermentation.readings.length === 0 ? (
            <p className="text-slate-400">Aún no hay lecturas registradas.</p>
          ) : (
            <div className="space-y-4">
              {fermentation.readings.map((reading) => (
                <div key={reading.id} className="rounded-2xl bg-slate-800 p-5">
                  <p className="text-sm text-slate-400">
                    {reading.createdAt.toLocaleString()}
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-5">
                    {reading.brix !== null && <Mini title="°Brix" value={reading.brix} />}
                    {reading.ph !== null && <Mini title="pH" value={reading.ph} />}
                    {reading.temperature !== null && <Mini title="Temp." value={`${reading.temperature}°C`} />}
                    {reading.alcohol !== null && <Mini title="Alcohol" value={`${reading.alcohol}%`} />}
                    {reading.saccharometer !== null && <Mini title="Sacarímetro" value={reading.saccharometer} />}
                  </div>

                  {(reading.citricAcidGrams ||
                    reading.bicarbonateGrams ||
                    reading.heatingMinutes) && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {reading.citricAcidGrams && <Mini title="Ácido" value={`${reading.citricAcidGrams} g`} />}
                      {reading.bicarbonateGrams && <Mini title="Bicarbonato" value={`${reading.bicarbonateGrams} g`} />}
                      {reading.heatingMinutes && <Mini title="Calentamiento" value={`${reading.heatingMinutes} min`} />}
                    </div>
                  )}

                  {reading.notes && (
                    <p className="mt-3 rounded-xl bg-slate-900 p-3 text-slate-300">
                      {reading.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <FermentationCharts readings={fermentation.readings} />
      </div>
    </main>
  );
}

function Kpi({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${highlight ? "text-green-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({ title, value }: { title: string | number; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-900 p-3">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}