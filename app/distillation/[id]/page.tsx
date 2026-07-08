import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";
import { DistillationEventType, DistillationStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentAlcohol,
  getCurrentTemperature,
  getTotalLiters,
  getHeartLiters,
  getHeadsLiters,
  getTailLiters,
  getCorrectedAlcohol,
  getAbsoluteAlcohol,
  getYield,
  getDistillationStatus,
} from "@/lib/services/distillation";
import DistillationTimeline from "@/components/DistillationTimeline";
import DistillationCharts from "@/components/DistillationCharts";
import { getSmartStatus } from "@/lib/services/distillationStatus";
import { getMasterAdvice } from "@/lib/services/maestroDistillation";


type Props = {
  params: Promise<{ id: string }>;
};

export default async function DistillationDetailPage({ params }: Props) {
  const { id } = await params;

  const distillation = await prisma.distillation.findUnique({
    where: { id },
    include: {
      lot: true,
      equipment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!distillation) notFound();

  const hasFinished = distillation.status === "TERMINADA";

const lastTemperature = getCurrentTemperature(distillation.events);

const lastOutputTemperature =
  [...distillation.events]
    .reverse()
    .find((event) => event.outputTemperature !== null)?.outputTemperature ?? null;

const lastAlcohol = getCurrentAlcohol(distillation.events);

const lastAlcoholCorrected = getCorrectedAlcohol(
  lastAlcohol,
  lastOutputTemperature
);

const totalLiters = getTotalLiters(distillation.events);
const headsLiters = getHeadsLiters(distillation.events);
const heartLiters = getHeartLiters(distillation.events);
const tailLiters = getTailLiters(distillation.events);

const absoluteAlcohol = getAbsoluteAlcohol(totalLiters, lastAlcoholCorrected);
const distillationYield = getYield(distillation.loadedLiters, totalLiters);
const processStatus = getDistillationStatus(distillation.events);
const advice = getMasterAdvice(
  lastTemperature,
  lastAlcohol,
  lastAlcoholCorrected,
  distillation.events
);
const smartStatus = getSmartStatus(distillation.events);

  async function addEvent(formData: FormData) {
    "use server";

    const type = formData.get("type") as DistillationEventType;

    const temperature = getNumber(formData, "temperature");
    const outputTemperature = getNumber(formData, "outputTemperature");
    const alcohol = getNumber(formData, "alcohol");
    const alcoholCorrected = getNumber(formData, "alcoholCorrected");
    const liters = getNumber(formData, "liters");
    const notes = formData.get("notes") as string;

    await prisma.distillationEvent.create({
      data: {
        distillationId: id,
        type,
        temperature,
        outputTemperature,
        alcohol,
        alcoholCorrected,
        liters,
        notes: notes || null,
      },
    });

    if (type === "FIN_DESTILACION") {
      await prisma.distillation.update({
        where: { id },
        data: {
          status: DistillationStatus.TERMINADA,
          finishedAt: new Date(),
          finalAlcohol: alcoholCorrected ?? alcohol,
        },
      });
    }

    redirect(`/distillation/${id}`);
  }

  const actions: {
    type: DistillationEventType;
    label: string;
    needsTemperature?: boolean;
    needsOutputTemperature?: boolean;
    needsAlcohol?: boolean;
    needsAlcoholCorrected?: boolean;
    needsLiters?: boolean;
  }[] = [
    { type: "INICIO_CALENTAMIENTO", label: "🔥 Inicio calentamiento" },
    {
      type: "TEMPERATURA",
      label: "🌡 Registrar temperatura",
      needsTemperature: true,
      needsOutputTemperature: true,
    },
    {
      type: "ALCOHOL",
      label: "🥃 Registrar alcohol",
      needsOutputTemperature: true,
      needsAlcohol: true,
      needsAlcoholCorrected: true,
    },
    {
      type: "LITROS",
      label: "💧 Registrar litros",
      needsLiters: true,
    },
    {
      type: "CORTE_CABEZAS",
      label: "✂️ Corte de cabezas",
      needsLiters: true,
      needsAlcohol: true,
      needsAlcoholCorrected: true,
    },
    { type: "INICIO_CORAZON", label: "❤️ Inicio corazón" },
    {
      type: "FIN_CORAZON",
      label: "❤️ Fin corazón",
      needsLiters: true,
      needsAlcohol: true,
      needsAlcoholCorrected: true,
    },
    { type: "INICIO_COLAS", label: "🟤 Inicio colas" },
    { type: "OBSERVACION", label: "📝 Observación" },
    {
      type: "FIN_DESTILACION",
      label: "🏁 Finalizar destilación",
      needsAlcohol: true,
      needsAlcoholCorrected: true,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Destilación {distillation.lot.code}
        </h1>
        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
  <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
    MAESTRO INTELIGENTE
  </p>

  <h2 className={`mt-3 text-3xl font-bold ${advice.color}`}>
  {advice.title}
</h2>

<p className="mt-2 text-slate-300">
  {advice.message}
</p>

  <div className="mt-4 grid gap-4 md:grid-cols-3">
    <Mini title="Alcohol actual" value={lastAlcohol ? `${lastAlcohol} %` : "-"} />
    <Mini title="Alcohol corregido" value={lastAlcoholCorrected ? `${lastAlcoholCorrected} %` : "-"} />
    <Mini title="Temperatura" value={lastTemperature ? `${lastTemperature} °C` : "-"} />
  </div>
</section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Card title="Alambique" value={distillation.equipment.name} />
          <Card title="Tipo" value={distillation.type} />
          <Card title="Cargado" value={`${distillation.loadedLiters} L`} />
          <Card title="Estado" value={processStatus}
/>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Card
            title="Temp. alambique"
            value={lastTemperature !== undefined ? `${lastTemperature} °C` : "-"}
          />
          <Card
            title="Temp. salida"
            value={
              lastOutputTemperature !== undefined
                ? `${lastOutputTemperature} °C`
                : "-"
            }
          />
          <Card
            title="Alcohol leído"
            value={lastAlcohol !== undefined ? `${lastAlcohol} %` : "-"}
          />
          <Card
            title="Alcohol corregido"
            value={
              lastAlcoholCorrected !== undefined
                ? `${lastAlcoholCorrected} %`
                : "-"
            }
          />
        </section>
<section className="mt-8 grid gap-4 md:grid-cols-4">
          <Card title="Litros acumulados" value={`${totalLiters} L`} />
          <Card
  title="Alcohol absoluto"
  value={absoluteAlcohol !== null ? `${absoluteAlcohol} LAA` : "-"}
/>

<Card
  title="Rendimiento"
  value={`${distillationYield} %`}
/>

<Card
  title="Cabezas"
  value={`${headsLiters} L`}
/>

<Card
  title="Corazón"
  value={`${heartLiters} L`}
/>

<Card
  title="Colas"
  value={`${tailLiters} L`}
/>
            <Card
  title="Alcohol inicial"
  value={
    distillation.initialAlcohol
      ? `${distillation.initialAlcohol} %`
      : "-"
  }
/>

<Card
  title="Alcohol final"
  value={
    distillation.finalAlcohol
      ? `${distillation.finalAlcohol} %`
      : "-"
  }
/>
        </section>
<DistillationTimeline events={distillation.events} />
<DistillationCharts events={distillation.events} />
        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">
              Acciones de destilación
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <form
  action={addEvent}
  className="rounded-2xl bg-slate-800 p-6 md:col-span-2"
>
  <p className="mb-4 text-xl font-bold">
    🥃 Registro de destilación
  </p>

  <div className="grid gap-3 md:grid-cols-2">

    <select
      name="type"
      className="rounded-xl bg-slate-900 p-3"
    >
      <option value="TEMPERATURA">Temperatura</option>
      <option value="ALCOHOL">Alcohol</option>
      <option value="LITROS">Registrar litros</option>
      <option value="CORTE_CABEZAS">Corte de cabezas</option>
      <option value="INICIO_CORAZON">Inicio corazón</option>
      <option value="FIN_CORAZON">Fin corazón</option>
      <option value="INICIO_COLAS">Inicio colas</option>
      <option value="OBSERVACION">Observación</option>
      <option value="FIN_DESTILACION">Finalizar destilación</option>
    </select>

    <input
      name="temperature"
      type="number"
      step="0.01"
      placeholder="Temperatura alambique °C"
      className="rounded-xl bg-slate-900 p-3"
    />

    <input
      name="outputTemperature"
      type="number"
      step="0.01"
      placeholder="Temperatura salida °C"
      className="rounded-xl bg-slate-900 p-3"
    />

    <input
      name="alcohol"
      type="number"
      step="0.01"
      placeholder="Alcohol leído %"
      className="rounded-xl bg-slate-900 p-3"
    />

    <input
      name="alcoholCorrected"
      type="number"
      step="0.01"
      placeholder="Alcohol corregido %"
      className="rounded-xl bg-slate-900 p-3"
    />

    <input
      name="liters"
      type="number"
      step="0.01"
      placeholder="Litros obtenidos"
      className="rounded-xl bg-slate-900 p-3"
    />

    <input
      name="notes"
      placeholder="Observaciones"
      className="rounded-xl bg-slate-900 p-3 md:col-span-2"
    />

  </div>

  <button className="mt-4 w-full rounded-xl bg-amber-400 py-3 font-bold text-black">
    Guardar registro
  </button>
</form>
              
            </div>
          </section>
        )}

        
      </div>
    </main>
  );
}

function getNumber(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!value || value === "") return null;

  return Number(value);
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Mini({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-900 p-3">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}