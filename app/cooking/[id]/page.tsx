import { prisma } from "@/lib/prisma";
import { CookingEventType, CookingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import MainNav from "@/components/MainNav";
import CookingCharts from "@/components/CookingCharts";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CookingDetailPage({ params }: Props) {
  const { id } = await params;

  const cooking = await prisma.cooking.findUnique({
    where: { id },
    include: {
      lot: true,
      equipment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!cooking) notFound();

  const hasStartedVapor = cooking.events.some(
    (event) => event.type === "INICIO_VAPOR"
  );

  const hasFinished = cooking.status === "TERMINADA";

  const lastTemperature = [...cooking.events]
    .reverse()
    .find((event) => event.type === "TEMPERATURA");

  async function addSimpleEvent(formData: FormData) {
    "use server";

 const type = formData.get("type") as CookingEventType;
const notes = formData.get("notes") as string;

const litersRaw = formData.get("liters");
const phRaw = formData.get("ph");
const brixRaw = formData.get("brix");
const temperatureRaw = formData.get("temperature");

const liters = litersRaw ? Number(litersRaw) : null;
const ph = phRaw ? Number(phRaw) : null;
const brix = brixRaw ? Number(brixRaw) : null;
const temperature = temperatureRaw ? Number(temperatureRaw) : null;

    await prisma.cookingEvent.create({
      data: {
  cookingId: id,
  type,
  liters,
  ph,
  brix,
  temperature,
  notes: notes || null,
},
      
    });

    if (type === CookingEventType.FIN_COCCION) {
      await prisma.cooking.update({
        where: { id },
        data: {
          status: CookingStatus.TERMINADA,
          finishedAt: new Date(),
        },
      });
    }

    redirect(`/cooking/${id}`);
  }

  async function addTemperatureEvent(formData: FormData) {
    "use server";

    const temperatureTop = Number(formData.get("temperatureTop"));
    const temperatureMiddle = Number(formData.get("temperatureMiddle"));
    const temperatureBottom = Number(formData.get("temperatureBottom"));
    const notes = formData.get("notes") as string;

    await prisma.cookingEvent.create({
      data: {
        cookingId: id,
        type: CookingEventType.TEMPERATURA,
        temperatureTop,
        temperatureMiddle,
        temperatureBottom,
        notes: notes || null,
      },
    });

    redirect(`/cooking/${id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
        <MainNav />
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Cocción {cooking.lot.code}
        </h1>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Horno</p>
            <p className="mt-2 text-2xl font-bold">{cooking.equipment.name}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Kg cargados</p>
            <p className="mt-2 text-2xl font-bold">
              {cooking.agaveKg.toLocaleString()} kg
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Estado</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              {cooking.status}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Vapor</p>
            <p className="mt-2 text-2xl font-bold">
              {hasStartedVapor ? "Iniciado" : "Pendiente"}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-slate-400">Avance de cocción</p>
      <h2 className="mt-1 text-3xl font-bold">
        {Math.min(cooking.events.filter(e => e.type === "TEMPERATURA").length * 5, 100)}%
      </h2>
    </div>

    <div className="text-right text-sm text-slate-400">
      <p>Meta: 32 horas</p>
      <p>{cooking.events.length} eventos registrados</p>
    </div>
  </div>

  <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">
    <div
      className="h-full rounded-full bg-amber-400 transition-all"
      style={{
        width: `${Math.min(
          cooking.events.filter(e => e.type === "TEMPERATURA").length * 5,
          100
        )}%`,
      }}
    />
  </div>
</section>
<section className="mt-6 rounded-2xl bg-slate-900 p-6">
  <h2 className="text-xl font-bold text-amber-400">
    Estado inteligente
  </h2>

  <div className="mt-5 grid gap-4 md:grid-cols-3">

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">
        Temperatura
      </p>

      <p className="mt-2 text-2xl font-bold text-green-400">
        {
  lastTemperature &&
  (lastTemperature.temperatureTop ?? 0) >= 90 &&
  (lastTemperature.temperatureBottom ?? 0) >= 90
    ? "OK"
    : "Calentando"
}
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">
        Vapor
      </p>

      <p className="mt-2 text-2xl font-bold text-green-400">
        {hasStartedVapor ? "Activo" : "Pendiente"}
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-5">
      <p className="text-sm text-slate-400">
        Cocción
      </p>

      <p className="mt-2 text-2xl font-bold text-amber-400">
        {cooking.status}
      </p>
    </div>

  </div>
</section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-4 text-2xl font-bold">Última temperatura</h2>

          {lastTemperature ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-800 p-5">
                <p className="text-sm text-slate-400">Superior</p>
                <p className="text-3xl font-bold">
                  {lastTemperature.temperatureTop ?? "-"}°C
                </p>
              </div>

              <div className="rounded-xl bg-slate-800 p-5">
                <p className="text-sm text-slate-400">Media</p>
                <p className="text-3xl font-bold">
                  {lastTemperature.temperatureMiddle ?? "-"}°C
                </p>
              </div>

              <div className="rounded-xl bg-slate-800 p-5">
                <p className="text-sm text-slate-400">Inferior</p>
                <p className="text-3xl font-bold">
                  {lastTemperature.temperatureBottom ?? "-"}°C
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">
              Todavía no hay temperaturas registradas.
            </p>
          )}
        </section>

        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">Acciones de cocción</h2>

            {!hasStartedVapor ? (
              <form action={addSimpleEvent}>
                <input
                  type="hidden"
                  name="type"
                  value="INICIO_VAPOR"
                />

                <button className="w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-bold text-black">
                  🔥 Iniciar vapor
                </button>
              </form>
            ) : (
              <div className="space-y-8">
                <form
                  action={addTemperatureEvent}
                  className="rounded-2xl bg-slate-800 p-6"
                >
                  <h3 className="mb-4 text-xl font-bold">
                    🌡 Registrar temperaturas
                  </h3>

                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      name="temperatureTop"
                      type="number"
                      step="0.1"
                      required
                      placeholder="Superior °C"
                      className="rounded-xl bg-slate-900 p-3"
                    />

                    <input
                      name="temperatureMiddle"
                      type="number"
                      step="0.1"
                      required
                      placeholder="Media °C"
                      className="rounded-xl bg-slate-900 p-3"
                    />

                    <input
                      name="temperatureBottom"
                      type="number"
                      step="0.1"
                      required
                      placeholder="Inferior °C"
                      className="rounded-xl bg-slate-900 p-3"
                    />
                  </div>

                  <input
                    name="notes"
                    placeholder="Observaciones"
                    className="mt-4 w-full rounded-xl bg-slate-900 p-3"
                  />

                  <button className="mt-4 rounded-xl bg-amber-400 px-6 py-3 font-bold text-black">
                    Guardar temperaturas
                  </button>
                </form>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["AUMENTAR_VAPOR", "⬆️ Aumentar vapor"],
                    ["BAJAR_VAPOR", "⬇️ Disminuir vapor"],
                    ["SUSPENDER_VAPOR", "⏸ Suspender vapor"],
                    ["MIELES_AMARGAS_FORM","🟠 Extraer mieles amargas"],
                    ["MIELES_DULCES_FORM","🟡 Extraer mieles dulces"],
                    ["OBSERVACION", "📝 Observación"],
                    ["FIN_COCCION", "🏁 Finalizar cocción"],
                  ].map(([type, label]) => (
                    <form key={type} action={addSimpleEvent}>
                    
  <input
    type="hidden"
    name="type"
    value={
      type === "MIELES_AMARGAS_FORM"
        ? "MIELES_AMARGAS"
        : type === "MIELES_DULCES_FORM"
          ? "MIELES_DULCES"
          : type
    }
  />

  {(type === "MIELES_AMARGAS_FORM" || type === "MIELES_DULCES_FORM") && (
<>
    <input
      name="liters"
      type="number"
      step="0.01"
      placeholder="Litros extraídos"
      className="mb-2 w-full rounded-xl bg-slate-800 p-3"
    />

    <input
      name="temperature"
      type="number"
      step="0.01"
      placeholder="Temperatura °C"
      className="mb-2 w-full rounded-xl bg-slate-800 p-3"
    />

    <input
      name="ph"
      type="number"
      step="0.01"
      placeholder="pH"
      className="mb-2 w-full rounded-xl bg-slate-800 p-3"
    />

    <input
      name="brix"
      type="number"
      step="0.01"
      placeholder="°Brix"
      className="mb-2 w-full rounded-xl bg-slate-800 p-3"
    />
  </>
)}

                      <input
                        name="notes"
                        placeholder="Observación opcional"
                        className="mb-2 w-full rounded-xl bg-slate-800 p-3"
                      />

                      <button className="w-full rounded-xl bg-slate-800 px-5 py-4 font-bold hover:bg-slate-700">
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
<section className="mb-8 rounded-2xl bg-slate-900 p-6">
  <h2 className="mb-6 text-2xl font-bold">📊 Resumen del cocimiento</h2>

  <div className="grid gap-4 md:grid-cols-4">

    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-slate-400 text-sm">🟠 Mieles amargas</p>
      <p className="text-3xl font-bold">
        {cooking.events
          .filter(e => e.type === "MIELES_AMARGAS")
          .reduce((t, e) => t + (e.liters ?? 0), 0)} L
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-slate-400 text-sm">🟡 Mieles dulces</p>
      <p className="text-3xl font-bold">
        {cooking.events
          .filter(e => e.type === "MIELES_DULCES")
          .reduce((t, e) => t + (e.liters ?? 0), 0)} L
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-slate-400 text-sm">🌡 Última temperatura</p>
      <p className="text-3xl font-bold">
        {cooking.events
          .filter(e => e.type === "TEMPERATURA")
          .at(-1)?.temperatureTop ?? "--"}°C
      </p>
    </div>

    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-slate-400 text-sm">📋 Eventos</p>
      <p className="text-3xl font-bold">
        {cooking.events.length}
      </p>
    </div>

  </div>
</section>
        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-4 text-2xl font-bold">Bitácora</h2>

          {cooking.events.length === 0 ? (
            <p className="text-slate-400">Aún no hay eventos registrados.</p>
          ) : (
            cooking.events.map((event) => (
              <div key={event.id} className="border-b border-slate-800 py-4">
              
 <p className="font-semibold text-amber-400">
 {(
  {
    TEMPERATURA: "🌡️ Temperatura",
    AUMENTAR_VAPOR: "⬆️ Aumentar vapor",
    BAJAR_VAPOR: "⬇️ Disminuir vapor",
    SUSPENDER_VAPOR: "⏸️ Suspender vapor",
    MIELES_AMARGAS: "🟠 Mieles amargas",
    MIELES_DULCES: "🟡 Mieles dulces",
    OBSERVACION: "📝 Observación",
    FIN_COCCION: "🏁 Finalizar cocción",
  } as Record<string, string>
)[event.type] ?? event.type}

</p>
<div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-4">
  {event.liters !== null && <p>💧 Litros: {event.liters} L</p>}
  {event.temperature !== null && <p>🌡️ Temp: {event.temperature} °C</p>}
  {event.ph !== null && <p>🧪 pH: {event.ph}</p>}
  {event.brix !== null && <p>🍬 °Brix: {event.brix}</p>}
  {event.notes && <p className="col-span-2 md:col-span-4">📝 {event.notes}</p>}
</div>
                <p className="text-sm text-slate-400">
                  {event.createdAt.toLocaleString()}
                </p>

                {event.type === "TEMPERATURA" && (
                  <div className="mt-2 text-sm text-slate-300">
                    <p>Superior: {event.temperatureTop}°C</p>
                    <p>Media: {event.temperatureMiddle}°C</p>
                    <p>Inferior: {event.temperatureBottom}°C</p>
                  </div>
                )}

                {event.notes && <p className="mt-2">{event.notes}</p>}
              </div>
            ))
          )}
        </section>
        <CookingCharts events={cooking.events} />
      </div>
    </main>
  );
}