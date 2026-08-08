import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PlusIcon,
  CalendarIcon,
} from "@/components/ui/icons";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value
  );

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PREPARING: "Preparando",
  READY: "Listo",
  IN_PROGRESS: "En curso",
  RETURN_PENDING: "Pendiente de regreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default async function EventosInventoryPage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    activeEventsCount,
    pendingReturnsCount,
    activePackagesCount,
    recentEvents,
    upcomingEvents,
  ] = await Promise.all([
    prisma.serviceEvent.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    prisma.serviceEvent.count({ where: { status: "RETURN_PENDING" } }),
    prisma.eventPackage.count({ where: { isActive: true } }),
    prisma.serviceEvent.findMany({
      where: { eventDate: { gte: thirtyDaysAgo } },
      include: { items: true },
    }),
    prisma.serviceEvent.findMany({
      where: {
        eventDate: { gte: new Date() },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { eventDate: "asc" },
      take: 6,
      include: { package: true },
    }),
  ]);

  const consumedCostLast30Days = recentEvents.reduce((total, event) => {
    const eventCost = event.items.reduce((sum, item) => {
      if (item.itemType === "EQUIPMENT") return sum;
      const sent =
        item.sentQuantity !== null
          ? Number(item.sentQuantity)
          : Number(item.plannedQuantity);
      const returned =
        item.returnedQuantity !== null ? Number(item.returnedQuantity) : 0;
      const damaged = Number(item.damagedQuantity);
      const consumed = Math.max(sent - returned - damaged, 0);
      const cost =
        item.unitCost !== null ? consumed * Number(item.unitCost) : 0;
      return sum + cost;
    }, 0);
    return total + eventCost;
  }, 0);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/administration/inventory"
              className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
            >
              ← Inventario
            </Link>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Inventario de eventos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              Paquetes, kits de equipo y control de salida/regreso por evento.
            </p>
          </div>

          <Link
            href="/administration/inventory/events/new"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo evento
          </Link>
        </div>

        {/*
          Los KPIs se quedan fijos arriba: son el pulso del área y
          deben verse sin importar en qué pestaña esté el usuario.
        */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">Eventos activos</p>
            <p className="mt-1 text-2xl font-bold text-on-surface">
              {activeEventsCount}
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">
              Pendientes de regreso
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                pendingReturnsCount > 0 ? "text-error" : "text-on-surface"
              }`}
            >
              {pendingReturnsCount}
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">
              Consumo en eventos (30 días)
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface">
              {formatCurrency(consumedCostLast30Days)}
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">Paquetes activos</p>
            <p className="mt-1 text-2xl font-bold text-on-surface">
              {activePackagesCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container">
          <div className="flex items-center gap-2 p-5 pb-0">
            <CalendarIcon className="h-4 w-4 text-on-surface-variant" />
            <h2 className="text-sm font-semibold text-on-surface-variant">
              Próximos eventos
            </h2>
          </div>

          <div className="divide-y divide-outline-variant p-5">
            {upcomingEvents.length === 0 && (
              <p className="text-sm text-on-surface-variant">
                No hay eventos próximos.
              </p>
            )}
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/administration/inventory/events/${event.id}`}
                className="flex items-center justify-between py-3 transition hover:opacity-80"
              >
                <div>
                  <p className="font-medium text-on-surface">
                    {event.clientName}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {event.location} ·{" "}
                    {new Date(event.eventDate).toLocaleDateString("es-MX")}
                    {event.package ? ` · ${event.package.name}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
                  {statusLabels[event.status] ?? event.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
