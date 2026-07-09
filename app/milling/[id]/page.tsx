import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import MillingCharts from "@/components/MillingCharts";

type Props = {
  params: Promise<{ id: string }>;
};

type DischargeForAverage = {
  litersRecovered: number;
  brix: number;
  ph: number;
  temperature: number;
};

function weightedAverage(
  items: DischargeForAverage[],
  getValue: (item: DischargeForAverage) => number
) {
  const totalLiters = items.reduce((sum, item) => sum + item.litersRecovered, 0);

  if (totalLiters === 0) return null;

  return (
    items.reduce(
      (sum, item) => sum + item.litersRecovered * getValue(item),
      0
    ) / totalLiters
  );
}

export default async function MillingDetailPage({ params }: Props) {
  const { id } = await params;

  const milling = await prisma.milling.findUnique({
    where: { id },
    include: {
      lot: true,
      equipment: true,
      events: { orderBy: { createdAt: "asc" } },
      discharges: {
        include: { tank: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!milling) notFound();

  const tanks = await prisma.equipment.findMany({
    where: { type: "TINA" },
    orderBy: { name: "asc" },
  });

  const hasFinished = milling.status === "TERMINADA";

  const totalLiters = milling.discharges.reduce(
    (sum, discharge) => sum + discharge.litersRecovered,
    0
  );

  const avgBrix = weightedAverage(milling.discharges, (d) => d.brix);
  const avgPh = weightedAverage(milling.discharges, (d) => d.ph);
  const avgTemp = weightedAverage(milling.discharges, (d) => d.temperature);

  async function addDischarge(formData: FormData) {
    "use server";

    const tankId = formData.get("tankId") as string;
    const litersRecovered = Number(formData.get("litersRecovered"));
    const brix = Number(formData.get("brix"));
    const ph = Number(formData.get("ph"));
    const temperature = Number(formData.get("temperature"));
    const notes = formData.get("notes") as string;

    if (!litersRecovered || !brix || !ph || !temperature) return;

    await prisma.millingDischarge.create({
      data: {
        millingId: id,
        tankId: tankId || null,
        litersRecovered,
        brix,
        ph,
        temperature,
        notes: notes || null,
      },
    });

    redirect(`/milling/${id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Molienda {milling.lot.code}
        </h1>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Equipo</p>
            <p className="mt-2 text-2xl font-bold">
              {milling.equipment.name}
            </p>
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
            <p className="mt-2 text-xl font-bold">
              {milling.startedAt.toLocaleString()}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-blue-950/70 p-8">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
            Mosto acumulado
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm text-slate-400">Litros recuperados</p>
              <p className="text-4xl font-bold">
                {totalLiters.toLocaleString()} L
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Descargas</p>
              <p className="text-3xl font-bold">
                {milling.discharges.length}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">°Brix promedio</p>
              <p className="text-3xl font-bold">
                {avgBrix ? avgBrix.toFixed(2) : "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">pH promedio</p>
              <p className="text-3xl font-bold">
                {avgPh ? avgPh.toFixed(2) : "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Temp. promedio</p>
              <p className="text-3xl font-bold">
                {avgTemp ? `${avgTemp.toFixed(1)}°C` : "-"}
              </p>
            </div>
          </div>
        </section>

        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">
              💧 Descargas a fermentación
            </h2>

            <form action={addDischarge} className="grid gap-4 md:grid-cols-2">
              <select name="tankId" className="rounded-xl bg-slate-800 p-3">
                <option value="">Selecciona tina destino</option>
                {tanks.map((tank) => (
                  <option key={tank.id} value={tank.id}>
                    {tank.name}
                  </option>
                ))}
              </select>

              <input
                name="litersRecovered"
                type="number"
                step="0.1"
                placeholder="Litros recuperados"
                className="rounded-xl bg-slate-800 p-3"
              />

              <input
                name="brix"
                type="number"
                step="0.1"
                placeholder="°Brix"
                className="rounded-xl bg-slate-800 p-3"
              />

              <input
                name="ph"
                type="number"
                step="0.01"
                placeholder="pH"
                className="rounded-xl bg-slate-800 p-3"
              />

              <input
                name="temperature"
                type="number"
                step="0.1"
                placeholder="Temperatura °C"
                className="rounded-xl bg-slate-800 p-3"
              />

              <input
                name="notes"
                placeholder="Observaciones"
                className="rounded-xl bg-slate-800 p-3"
              />

              <button className="rounded-xl bg-amber-400 py-3 font-bold text-black md:col-span-2">
                Guardar descarga
              </button>
            </form>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold">Descargas registradas</h2>

          {milling.discharges.length === 0 ? (
            <p className="text-slate-400">Aún no hay descargas registradas.</p>
          ) : (
            <div className="space-y-4">
              {milling.discharges.map((discharge) => (
                <div
                  key={discharge.id}
                  className="rounded-xl bg-slate-800 p-5"
                >
                  <p className="font-bold text-amber-400">
                    {discharge.tank?.name ?? "Sin tina asignada"}
                  </p>

                  <div className="mt-2 grid gap-2 text-sm text-slate-300 md:grid-cols-4">
                    <p>{discharge.litersRecovered} L</p>
                    <p>{discharge.brix} °Bx</p>
                    <p>pH {discharge.ph}</p>
                    <p>{discharge.temperature}°C</p>
                  </div>

                  {discharge.notes && (
                    <p className="mt-3 text-slate-400">{discharge.notes}</p>
                  )}

                  <p className="mt-3 text-xs text-slate-500">
                    {discharge.createdAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <MillingCharts events={milling.events} />

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold">Bitácora</h2>

          {milling.events.length === 0 ? (
            <p className="text-slate-400">Aún no hay eventos registrados.</p>
          ) : (
            <div className="space-y-4">
              {milling.events.map((event) => (
                <div key={event.id} className="border-b border-slate-800 py-4">
                  <p className="font-semibold text-amber-400">{event.type}</p>
                  <p className="text-sm text-slate-400">
                    {event.createdAt.toLocaleString()}
                  </p>
                  {event.notes && <p className="mt-2">{event.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}