import { prisma } from "@/lib/prisma";
import { MillingEventType, MillingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import MainNav from "@/components/MainNav";
import MillingCharts from "@/components/MillingCharts";

type Props = {
  params: Promise<{ id: string }>;
};

type MillingUpdateData = {
  brix?: number | null;
  ph?: number | null;
  temperature?: number | null;
  waterLiters?: number;
  bagasseKg?: number | null;
  washBagasse?: boolean;
  washRecoveredLiters?: number | null;
  status?: MillingStatus;
  finishedAt?: Date;
};

export default async function MillingDetailPage({ params }: Props) {
  const { id } = await params;

  const milling = await prisma.milling.findUnique({
    where: { id },
    include: {
      lot: true,
      equipment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!milling) notFound();

  const hasFinished = milling.status === "TERMINADA";

  async function addEvent(formData: FormData) {
    "use server";

    const type = formData.get("type") as MillingEventType;
    const valueRaw = formData.get("value");
    const notes = formData.get("notes") as string;
    const brix = Number(formData.get("brix") || 0);
const ph = Number(formData.get("ph") || 0);
const temperature = Number(formData.get("temperature") || 0);
const waterLiters = Number(formData.get("waterLiters") || 0);
const bagasseKg = Number(formData.get("bagasseKg") || 0);
const washRecoveredLiters = Number(formData.get("washRecoveredLiters") || 0);
const pressPasses = Number(formData.get("pressPasses") || 0);

    const currentMilling = await prisma.milling.findUnique({
      where: { id },
    });

    if (!currentMilling) return;

    const value = valueRaw && valueRaw !== "" ? Number(valueRaw) : null;

    await prisma.millingEvent.create({
  data: {
    millingId: id,
    type,
    value,

    brix,
    ph,
    temperature,
    waterLiters,
    bagasseKg,
    washRecoveredLiters,
    pressPasses,

    notes: notes || null,
  },
});

    const updateData: MillingUpdateData = {};
    if (type === MillingEventType.OBSERVACION) {
  updateData.brix = brix || currentMilling.brix;
  updateData.ph = ph || currentMilling.ph;
  updateData.temperature = temperature || currentMilling.temperature;
  updateData.waterLiters = (currentMilling.waterLiters ?? 0) + waterLiters;
  updateData.bagasseKg = bagasseKg || currentMilling.bagasseKg;
}

    if (type === MillingEventType.REGISTRO_BRIX) {
      updateData.brix = value;
    }

    if (type === MillingEventType.REGISTRO_PH) {
      updateData.ph = value;
    }

    if (type === MillingEventType.REGISTRO_TEMPERATURA) {
      updateData.temperature = value;
    }

    if (type === MillingEventType.AGREGAR_AGUA) {
      updateData.waterLiters =
        (currentMilling.waterLiters ?? 0) + (value ?? 0);
    }

    if (type === MillingEventType.REGISTRO_BAGAZO) {
      updateData.bagasseKg = value;
    }

    if (type === MillingEventType.LAVADO_BAGAZO) {
      updateData.washBagasse = true;
      updateData.washRecoveredLiters = value;
    }

    if (type === MillingEventType.FIN_MOLIENDA) {
      updateData.status = MillingStatus.TERMINADA;
      updateData.finishedAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.milling.update({
        where: { id },
        data: updateData,
      });
    }

    redirect(`/milling/${id}`);
  }

  const efficiency =
    milling.cookedKg > 0 && milling.waterLiters
      ? ((milling.waterLiters / milling.cookedKg) * 100).toFixed(2)
      : "-";

  const actions: {
    type: MillingEventType;
    label: string;
    placeholder: string;
    needsValue: boolean;
  }[] = [
    {
  type: MillingEventType.OBSERVACION,
  label: "📋 Registro de molienda",
  placeholder: "Registro general de molienda",
  needsValue: false,
},
    {
      type: MillingEventType.REGISTRO_BRIX,
      label: "📈 Registrar °Brix",
      placeholder: "Valor °Brix",
      needsValue: true,
    },
    {
      type: MillingEventType.REGISTRO_PH,
      label: "🧪 Registrar pH",
      placeholder: "Valor pH",
      needsValue: true,
    },
    {
      type: MillingEventType.REGISTRO_TEMPERATURA,
      label: "🌡 Registrar temperatura",
      placeholder: "Temperatura °C",
      needsValue: true,
    },
    {
      type: MillingEventType.AGREGAR_AGUA,
      label: "💧 Agregar agua",
      placeholder: "Litros de agua",
      needsValue: true,
    },
    {
      type: MillingEventType.REGISTRO_BAGAZO,
      label: "🌿 Registrar bagazo",
      placeholder: "Kg de bagazo",
      needsValue: true,
    },
    {
      type: MillingEventType.LAVADO_BAGAZO,
      label: "🚿 Lavado de bagazo",
      placeholder: "Litros recuperados",
      needsValue: true,
    },
    {
      type: MillingEventType.OBSERVACION,
      label: "📝 Observación",
      placeholder: "Observación",
      needsValue: false,
    },
    {
      type: MillingEventType.FIN_MOLIENDA,
      label: "🏁 Finalizar molienda",
      placeholder: "Observaciones finales",
      needsValue: false,
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
          Molienda {milling.lot.code}
        </h1>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Equipo</p>
            <p className="mt-2 text-2xl font-bold">{milling.equipment.name}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Kg cocidos</p>
            <p className="mt-2 text-2xl font-bold">
              {milling.cookedKg.toLocaleString()} kg
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Estado</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              {milling.status}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Inicio</p>
            <p className="mt-2 text-lg font-bold">
              {milling.startedAt.toLocaleString()}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-6">
          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">°Brix</p>
            <p className="text-2xl font-bold">{milling.brix ?? "-"}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">pH</p>
            <p className="text-2xl font-bold">{milling.ph ?? "-"}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Temp.</p>
            <p className="text-2xl font-bold">{milling.temperature ?? "-"}°C</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Agua</p>
            <p className="text-2xl font-bold">{milling.waterLiters ?? 0} L</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Bagazo</p>
            <p className="text-2xl font-bold">{milling.bagasseKg ?? "-"} kg</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Agua/kg</p>
            <p className="text-2xl font-bold">{efficiency}</p>
          </div>
        </section>

        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">Acciones de molienda</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <form action={addEvent} className="rounded-2xl bg-slate-800 p-6 md:col-span-2">
  <input type="hidden" name="type" value={MillingEventType.OBSERVACION} />

  <p className="mb-4 text-xl font-bold">📋 Registro de molienda</p>

  <div className="grid gap-3 md:grid-cols-2">
    <input name="brix" type="number" step="0.01" placeholder="°Brix" className="rounded-xl bg-slate-900 p-3" />
    <input name="ph" type="number" step="0.01" placeholder="pH" className="rounded-xl bg-slate-900 p-3" />
    <input name="temperature" type="number" step="0.01" placeholder="Temperatura °C" className="rounded-xl bg-slate-900 p-3" />
    <input name="waterLiters" type="number" step="0.01" placeholder="Litros de agua agregados" className="rounded-xl bg-slate-900 p-3" />
    <input name="bagasseKg" type="number" step="0.01" placeholder="Kg de bagazo" className="rounded-xl bg-slate-900 p-3" />
    <input name="washRecoveredLiters" type="number" step="0.01" placeholder="Litros recuperados lavado" className="rounded-xl bg-slate-900 p-3" />
    <input name="pressPasses" type="number" step="1" placeholder="Pasadas de prensa" className="rounded-xl bg-slate-900 p-3" />
    <input name="notes" placeholder="Observaciones" className="rounded-xl bg-slate-900 p-3" />
  </div>

  <button className="mt-4 w-full rounded-xl bg-amber-400 px-5 py-4 font-bold text-slate-950">
    Guardar registro de molienda
  </button>
</form>
              </div>     
</section>
)}

                 
        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
  <h2 className="mb-6 text-2xl font-bold">Estado inteligente</h2>

  <div className="grid gap-4 md:grid-cols-4">

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">°Brix</p>
      <p className="mt-2 text-2xl font-bold text-green-400">
        {milling.brix ? `${milling.brix} °Bx` : "-"}
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">pH</p>
      <p className="mt-2 text-2xl font-bold text-green-400">
        {milling.ph ?? "-"}
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">Temperatura</p>
      <p className="mt-2 text-2xl font-bold text-green-400">
        {milling.temperature ? `${milling.temperature}°C` : "-"}
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">Estado</p>
      <p className="mt-2 text-2xl font-bold text-amber-400">
        {hasFinished ? "Terminada" : "En proceso"}
      </p>
    </div>

  </div>
</section>
<MillingCharts events={milling.events} />
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
  <h2 className="mb-6 text-2xl font-bold">Bitácora</h2>

  {milling.events.length === 0 ? (
    <p className="text-slate-400">Aún no hay eventos registrados.</p>
  ) : (
    <div className="space-y-4">
      {milling.events.map((event) => {
        const labels: Record<string, string> = {
          REGISTRO_BRIX: "📈 Registro de °Brix",
          REGISTRO_PH: "🧪 Registro de pH",
          REGISTRO_TEMPERATURA: "🌡 Registro de temperatura",
          AGREGAR_AGUA: "💧 Agua agregada",
          REGISTRO_BAGAZO: "🌿 Registro de bagazo",
          LAVADO_BAGAZO: "🚿 Lavado de bagazo",
          CAMBIO_PRENSA: "♻️ Cambio de prensa",
          OBSERVACION: "📝 Observación",
          FIN_MOLIENDA: "🏁 Fin de molienda",
        };

        const units: Record<string, string> = {
          REGISTRO_BRIX: "°Bx",
          REGISTRO_PH: "pH",
          REGISTRO_TEMPERATURA: "°C",
          AGREGAR_AGUA: "L",
          REGISTRO_BAGAZO: "kg",
          LAVADO_BAGAZO: "L recuperados",
        };

        return (
          <div key={event.id} className="rounded-2xl bg-slate-800 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-bold text-amber-400">
                {labels[event.type] ?? event.type}
              </p>

              <p className="text-sm text-slate-400">
                {event.createdAt.toLocaleString()}
              </p>
            </div>

            {event.value !== null && (
              <p className="mt-3 text-3xl font-bold">
                {event.value} {units[event.type] ?? ""}
              </p>
            )}

            {event.notes && (
              <p className="mt-3 rounded-xl bg-slate-900 p-3 text-slate-300">
                {event.notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  )}
</section>
      </div>
    </main>
  );
}
