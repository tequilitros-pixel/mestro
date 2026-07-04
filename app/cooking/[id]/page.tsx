import { prisma } from "@/lib/prisma";
import { CookingEventType, CookingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

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

  async function addEvent(formData: FormData) {
    "use server";

    const type = formData.get("type") as CookingEventType;
    const notes = formData.get("notes") as string;

    if (!type) return;

    await prisma.cookingEvent.create({
      data: {
        cookingId: id,
        type,
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

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Cocción {cooking.lot.code}
        </h1>

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <p>Horno: {cooking.equipment.name}</p>
          <p>Kg cargados: {cooking.agaveKg.toLocaleString()} kg</p>
          <p>Estado: {cooking.status}</p>
          <p>Notas: {cooking.notes || "Sin observaciones"}</p>
        </section>

        {!hasFinished && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-8">
            <h2 className="mb-4 text-2xl font-bold">Agregar evento</h2>

            <form action={addEvent} className="grid gap-4 md:grid-cols-2">
              <select
                name="type"
                required
                className="rounded-xl bg-slate-800 p-3 text-white"
              >
                {!hasStartedVapor && (
                  <option value="INICIO_VAPOR">Iniciar vapor</option>
                )}

                {hasStartedVapor && (
                  <>
                    <option value="TEMPERATURA">Registrar temperatura</option>
                    <option value="BAJAR_VAPOR">Disminuir vapor</option>
                    <option value="SUSPENDER_VAPOR">Suspender vapor</option>
                    <option value="MIELES_AMARGAS">
                      Extraer mieles amargas
                    </option>
                    <option value="MIELES_DULCES">
                      Extraer mieles dulces
                    </option>
                    <option value="OBSERVACION">Observación</option>
                    <option value="FIN_COCCION">Finalizar cocción</option>
                  </>
                )}
              </select>

              <input
                name="notes"
                placeholder="Observaciones"
                className="rounded-xl bg-slate-800 p-3 text-white"
              />

              <button className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black md:col-span-2">
                Guardar evento
              </button>
            </form>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-8">
          <h2 className="mb-4 text-2xl font-bold">Bitácora</h2>

          {cooking.events.length === 0 ? (
            <p className="text-slate-400">Aún no hay eventos registrados.</p>
          ) : (
            cooking.events.map((event) => (
              <div key={event.id} className="border-b border-slate-800 py-4">
                <p className="font-semibold text-amber-400">{event.type}</p>
                <p className="text-sm text-slate-400">
                  {event.createdAt.toLocaleString()}
                </p>
                {event.notes && <p className="mt-1">{event.notes}</p>}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}