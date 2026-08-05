import Link from "next/link";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PREPARING: "Preparando",
  READY: "Listo",
  IN_PROGRESS: "En curso",
  RETURN_PENDING: "Pendiente de regreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default async function EventsPage() {
  const events = await prisma.serviceEvent.findMany({
    orderBy: { eventDate: "desc" },
    include: { package: true, equipmentKit: true },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Eventos</h1>
            <p className="mt-2 text-on-surface-variant">
              Cotización, checklist de salida y regreso, consumo y utilidad.
            </p>
          </div>

          <Link
            href="/administration/inventory/events/new"
            className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            + Nuevo evento
          </Link>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          {events.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">Aún no hay eventos.</p>
          )}

          {events.map((event) => (
            <Link
              key={event.id}
              href={`/administration/inventory/events/${event.id}`}
              className="flex items-center justify-between p-6 transition hover:bg-surface-container-high/50"
            >
              <div>
                <p className="font-semibold text-on-surface">{event.clientName}</p>
                <p className="text-sm text-on-surface-variant">
                  {event.location} ·{" "}
                  {new Date(event.eventDate).toLocaleDateString("es-MX")} ·{" "}
                  {event.guestCount} invitados
                  {event.package ? ` · ${event.package.name}` : ""}
                  {event.equipmentKit ? ` · ${event.equipmentKit.name}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
                {statusLabels[event.status] ?? event.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
