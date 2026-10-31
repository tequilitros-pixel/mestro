import { prisma } from "@/lib/prisma";
import EventsListClient from "./EventsListClient";

export default async function EventsPage() {
  const rawEvents = await prisma.serviceEvent.findMany({
    where: {
      NOT: {
        AND: [
          { code: { startsWith: "COT-" } },
          { status: "DRAFT" },
        ],
      },
    },
    orderBy: { eventDate: "desc" },
    include: {
      package: { select: { id: true, name: true } },
      equipmentKit: { select: { id: true, name: true } },
    },
  });

  const events = rawEvents.map((ev) => ({
    id: ev.id,
    code: ev.code,
    clientName: ev.clientName,
    clientPhone: ev.clientPhone,
    location: ev.location,
    eventDate: ev.eventDate,
    guestCount: ev.guestCount,
    saleAmount: ev.saleAmount !== null ? Number(ev.saleAmount) : null,
    status: ev.status,
    notes: ev.notes,
    package: ev.package,
    equipmentKit: ev.equipmentKit,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Logística y Control de Eventos</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Administración completa: carga de remolque, contralista de retorno, mermas, conciliación y utilidad en tiempo real.
          </p>
        </div>

        <EventsListClient events={events} />
      </div>
    </main>
  );
}
