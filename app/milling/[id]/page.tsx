import { prisma } from "@/lib/prisma";
import { MillingEventType, MillingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
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

    const value =
      valueRaw && valueRaw !== "" ? Number(valueRaw) : null;

    await prisma.millingEvent.create({
      data: {
        millingId: id,
        type,
        value,
        notes: notes || null,
      },
    });

   const updateData: {
  brix?: number | null;
  ph?: number | null;
  temperature?: number | null;
  waterLiters?: number;
  bagasseKg?: number | null;
  status?: MillingStatus;
  finishedAt?: Date;
} = {};

    if (type === MillingEventType.REGISTRO_BRIX) updateData.brix = value;
    if (type === MillingEventType.REGISTRO_PH) updateData.ph = value;
    if (type === MillingEventType.REGISTRO_TEMPERATURA) updateData.temperature = value;
    if (type === MillingEventType.AGREGAR_AGUA) updateData.waterLiters = ((milling?.waterLiters ?? 0) + (value ?? 0));
    if (type === MillingEventType.REGISTRO_BAGAZO) updateData.bagasseKg = value;
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

  const actions: {
    type: MillingEventType;
    label: string;
    placeholder: string;
    needsValue: boolean;
  }[] = [
    {
      type: MillingEventType.REGISTRO_BRIX,
      label: "🌡 Registrar °Brix",
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
      label: "🔥 Registrar temperatura",
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
      label: "🟤 Registrar bagazo",
      placeholder: "Kg de bagazo",
      needsValue: true,
    },
    {
      type: MillingEventType.LAVADO_BAGAZO,
      label: "🚿 Lavado de bagazo",
      placeholder: "Litros recuperados u observación",
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

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">°Brix</p>
            <p className="text-2xl font-bold">{milling.brix ?? "-"}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">pH</p>
            <p className="text-2xl font-bold">{milling.ph ?? "-"}</p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Temperatura</p>
            <p className="text-2xl font-bold">
              {milling.temperature ?? "-"}°C
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Agua</p>
            <p className="text-2xl font-bold">
              {milling.waterLiters ?? 0} L
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Bagazo</p>
            <p className="text-2xl font-bold">
              {milling.bagasseKg ?? "-"} kg
            </p>
          </div>
        </section>

        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-6 text-2xl font-bold">Acciones de molienda</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {actions.map((action) => (
                <form
                  key={action.type}
                  action={addEvent}
                  className="rounded-2xl bg-slate-800 p-5"
                >
                  <input type="hidden" name="type" value={action.type} />

                  <p className="mb-3 font-bold">{action.label}</p>

                  {action.needsValue && (
                    <input
                      name="value"
                      type="number"
                      step="0.01"
                      placeholder={action.placeholder}
                      className="mb-3 w-full rounded-xl bg-slate-900 p-3"
                      required
                    />
                  )}

                  <input
                    name="notes"
                    placeholder="Observaciones"
                    className="mb-3 w-full rounded-xl bg-slate-900 p-3"
                  />

                  <button className="w-full rounded-xl bg-amber-400 py-3 font-bold text-black">
                    Guardar
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-4 text-2xl font-bold">Bitácora</h2>

          {milling.events.length === 0 ? (
            <p className="text-slate-400">Aún no hay eventos registrados.</p>
          ) : (
            milling.events.map((event) => (
              <div key={event.id} className="border-b border-slate-800 py-4">
                <p className="font-semibold text-amber-400">{event.type}</p>

                <p className="text-sm text-slate-400">
                  {event.createdAt.toLocaleString()}
                </p>

                {event.value !== null && (
                  <p className="mt-1">Valor: {event.value}</p>
                )}

                {event.notes && <p className="mt-1">{event.notes}</p>}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}